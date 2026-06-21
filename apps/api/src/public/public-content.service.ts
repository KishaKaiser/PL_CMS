import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import {
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_SITE_EXTENSION_POINTS,
  DEFAULT_SITE_IDENTITY,
  DEFAULT_SITE_THEME,
  PUBLIC_SITE_SETTING_KEYS,
  SITE_SETTING_KEYS,
  type HomepageSettings,
  type PostsPageSettings,
  type SiteExtensionPoints,
  type SiteHomepageBlock,
  type SiteIdentitySettings,
  type SiteMenuItem,
  type SiteThemeSettings,
} from '@pl-cms/shared';
import { PrismaService } from '../prisma/prisma.service';

type PostQuery = {
  search?: string;
  categorySlug?: string;
  tagSlug?: string;
  authorId?: string;
  year?: string;
  month?: string;
};

type PublicSiteConfig = {
  identity: SiteIdentitySettings;
  homepage: {
    mode: 'landing' | 'latest_posts' | 'page';
    pageSlug: string;
    selectedPage: { slug: string; title: string } | null;
  };
  postsPage: {
    type: 'default' | 'page';
    pageSlug: string;
    path: string;
    title: string;
  };
  menus: {
    header: SiteMenuItem[];
    footer: SiteMenuItem[];
  };
  theme: SiteThemeSettings;
  homepageBlocks: SiteHomepageBlock[];
  extensionPoints: SiteExtensionPoints;
};

const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  metaTitle: true,
  metaDescription: true,
  excerpt: true,
  content: true,
  featuredImageUrl: true,
  publishedAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  categories: { select: { id: true, slug: true, name: true } },
  tags: { select: { id: true, slug: true, name: true } },
} as const;

// 1970 keeps archives aligned with Unix-epoch era content and rejects obviously invalid historical years.
const MIN_ARCHIVE_YEAR = 1970;
// A small future buffer supports scheduled content while rejecting malformed far-future years.
const MAX_ARCHIVE_YEARS_AHEAD = 20;
const MAX_REDIRECT_DEPTH = 5;

@Injectable()
export class PublicContentService {
  private readonly logger = new Logger(PublicContentService.name);
  private readonly siteConfigTransformers: Array<(config: PublicSiteConfig) => PublicSiteConfig> = [];

  constructor(private readonly prisma: PrismaService) {}

  registerSiteConfigTransformer(transformer: (config: PublicSiteConfig) => PublicSiteConfig) {
    this.siteConfigTransformers.push(transformer);
  }

  async getSiteConfig() {
    const now = new Date();
    const [settings, publishedPages, activeCmsTheme] = await Promise.all([
      this.prisma.setting.findMany({
        where: { key: { in: [...PUBLIC_SITE_SETTING_KEYS] } },
      }),
      this.prisma.page.findMany({
        where: { publishedAt: { not: null, lte: now } },
        orderBy: { title: 'asc' },
        select: {
          slug: true,
          title: true,
        },
      }),
      this.prisma.cmsTheme.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { globalStyles: true },
      }),
    ]);

    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const publishedPageMap = new Map(publishedPages.map((page) => [page.slug, page]));

    const identity = this.normalizeIdentitySettings(settingMap);
    const homepage = this.normalizeHomepageSettings(
      settingMap.get(SITE_SETTING_KEYS.SITE_HOMEPAGE),
      publishedPageMap,
    );
    const postsPage = this.normalizePostsPageSettings(
      settingMap.get(SITE_SETTING_KEYS.SITE_POSTS_PAGE),
      publishedPageMap,
    );
    const theme = this.applyCmsThemeStyles(
      this.normalizeThemeSettings(settingMap.get(SITE_SETTING_KEYS.SITE_THEME), postsPage.path),
      activeCmsTheme?.globalStyles,
    );
    const extensionPoints = this.normalizeExtensionPoints(
      settingMap.get(SITE_SETTING_KEYS.SITE_EXTENSION_POINTS),
    );
    const menus = this.normalizeMenus(
      settingMap.get(SITE_SETTING_KEYS.SITE_MENUS),
      publishedPages,
      postsPage,
      extensionPoints,
    );
    const homepageBlocks = this.normalizeHomepageBlocks(
      settingMap.get(SITE_SETTING_KEYS.SITE_HOMEPAGE_BLOCKS),
      theme,
      postsPage.path,
    );

    const config: PublicSiteConfig = {
      identity,
      homepage,
      postsPage,
      menus,
      theme,
      homepageBlocks,
      extensionPoints,
    };

    return this.applySiteConfigTransformers(config);
  }

  findPublishedPages(excludeSlug?: string) {
    const now = new Date();
    return this.prisma.page.findMany({
      where: {
        ...(excludeSlug ? { slug: { not: excludeSlug } } : {}),
        publishedAt: { not: null, lte: now },
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        content: true,
        featuredImageUrl: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  }

  async findPublishedPageBySlug(slug: string) {
    const now = new Date();
    const page = await this.prisma.page.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        content: true,
        featuredImageUrl: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) throw new NotFoundException(`Page ${slug} not found`);
    const builderLayout = await this.prisma.builderLayout.findUnique({
      where: { entityType_entityId: { entityType: 'page', entityId: page.id } },
      select: { publishedJson: true, status: true },
    });
    const activeCmsTheme = await this.prisma.cmsTheme.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { templates: true },
    });
    const themeLayout = this.getThemePageLayout(activeCmsTheme?.templates);
    return {
      ...page,
      builderLayout:
        builderLayout?.status === 'PUBLISHED' ? builderLayout.publishedJson : themeLayout,
    };
  }

  async findPageRedirectBySlug(slug: string) {
    return {
      redirectTo: await this.findPublishedRedirectTarget('PAGE', slug),
    };
  }

  findPublishedPosts(query: PostQuery = {}) {
    return this.prisma.post.findMany({
      where: this.getPublishedPostWhere(query),
      orderBy: { publishedAt: 'desc' },
      select: POST_SELECT,
    });
  }

  async findPublishedPostBySlug(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: POST_SELECT,
    });

    if (!post) throw new NotFoundException(`Post ${slug} not found`);
    return post;
  }

  async findPostRedirectBySlug(slug: string) {
    return {
      redirectTo: await this.findPublishedRedirectTarget('POST', slug),
    };
  }

  async findCategories() {
    const now = new Date();
    const categories = await this.prisma.category.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      postCount: category.posts.length,
    }));
  }

  async findPostsByCategorySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!category) throw new NotFoundException(`Category ${slug} not found`);

    const posts = await this.findPublishedPosts({ categorySlug: slug });
    return { category, posts };
  }

  async findTags() {
    const now = new Date();
    const tags = await this.prisma.tag.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      slug: tag.slug,
      name: tag.name,
      postCount: tag.posts.length,
    }));
  }

  async findPostsByTagSlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (!tag) throw new NotFoundException(`Tag ${slug} not found`);

    const posts = await this.findPublishedPosts({ tagSlug: slug });
    return { tag, posts };
  }

  async findAuthors() {
    const now = new Date();
    const authors = await this.prisma.user.findMany({
      where: {
        posts: {
          some: { publishedAt: { not: null, lte: now } },
        },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        posts: {
          where: { publishedAt: { not: null, lte: now } },
          select: { id: true },
        },
      },
    });

    return authors.map((author) => ({
      id: author.id,
      name: author.name,
      postCount: author.posts.length,
    }));
  }

  async findPostsByAuthorId(authorId: string) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { id: true, name: true },
    });
    if (!author) throw new NotFoundException(`Author ${authorId} not found`);

    const posts = await this.findPublishedPosts({ authorId });
    return { author, posts };
  }

  async findRelatedPosts(slug: string) {
    const now = new Date();
    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: {
        id: true,
        categories: { select: { id: true } },
        tags: { select: { id: true } },
      },
    });

    if (!post) throw new NotFoundException(`Post ${slug} not found`);

    const categoryIds = post.categories.map((category) => category.id);
    const tagIds = post.tags.map((tag) => tag.id);
    const relatedFilter: Prisma.PostWhereInput[] = [];

    if (categoryIds.length > 0) {
      relatedFilter.push({ categories: { some: { id: { in: categoryIds } } } });
    }
    if (tagIds.length > 0) {
      relatedFilter.push({ tags: { some: { id: { in: tagIds } } } });
    }

    const related = await this.prisma.post.findMany({
      where: {
        id: { not: post.id },
        publishedAt: { not: null, lte: now },
        ...(relatedFilter.length > 0 ? { OR: relatedFilter } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: POST_SELECT,
    });

    if (related.length >= 3) return related;

    const fallback = await this.prisma.post.findMany({
      where: {
        id: { notIn: [post.id, ...related.map((item) => item.id)] },
        publishedAt: { not: null, lte: now },
      },
      orderBy: { publishedAt: 'desc' },
      take: 3 - related.length,
      select: POST_SELECT,
    });

    return [...related, ...fallback];
  }

  async findArchives() {
    const now = new Date();
    const posts = await this.prisma.post.findMany({
      where: { publishedAt: { not: null, lte: now } },
      select: { publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    const archiveMap = new Map<string, number>();
    for (const post of posts) {
      if (!post.publishedAt) continue;
      const year = post.publishedAt.getUTCFullYear();
      const month = post.publishedAt.getUTCMonth() + 1;
      const key = `${year}-${String(month).padStart(2, '0')}`;
      archiveMap.set(key, (archiveMap.get(key) ?? 0) + 1);
    }

    return Array.from(archiveMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, count]) => {
        const [year, month] = key.split('-');
        return {
          key,
          year: Number(year),
          month: Number(month),
          count,
        };
      });
  }

  private normalizeIdentitySettings(settingMap: Map<string, string>): SiteIdentitySettings {
    const identityValue = this.parseJsonSetting<Partial<SiteIdentitySettings>>(
      settingMap.get(SITE_SETTING_KEYS.SITE_IDENTITY),
    );
    const fallbackTitle = settingMap.get(SITE_SETTING_KEYS.SITE_NAME)?.trim() || DEFAULT_SITE_IDENTITY.title;

    return {
      title: this.getString(identityValue?.title, fallbackTitle),
      tagline: this.getString(identityValue?.tagline, DEFAULT_SITE_IDENTITY.tagline),
      logoUrl: this.getString(identityValue?.logoUrl, DEFAULT_SITE_IDENTITY.logoUrl),
      faviconUrl: this.getString(identityValue?.faviconUrl, DEFAULT_SITE_IDENTITY.faviconUrl),
      footerText: this.getString(identityValue?.footerText, DEFAULT_SITE_IDENTITY.footerText),
    };
  }

  private applySiteConfigTransformers(config: PublicSiteConfig) {
    return this.siteConfigTransformers.reduce((currentConfig, transformer) => {
      try {
        return transformer(currentConfig);
      } catch (error) {
        this.logger.warn(
          `Ignored site-config transformer failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        return currentConfig;
      }
    }, config);
  }

  private normalizeHomepageSettings(
    value: string | undefined,
    publishedPageMap: Map<string, { slug: string; title: string }>,
  ) {
    const parsed = this.parseJsonSetting<Partial<HomepageSettings>>(value);
    const pageSlug = this.getString(parsed?.pageSlug, '');
    const mode: HomepageSettings['mode'] =
      parsed?.mode === 'page' || parsed?.mode === 'latest_posts' ? parsed.mode : 'landing';
    const selectedPage = pageSlug ? publishedPageMap.get(pageSlug) : null;

    if (mode === 'page' && !selectedPage) {
      if (pageSlug) {
        this.logger.warn(
          `Homepage page "${pageSlug}" not found in published pages; falling back to landing mode.`,
        );
      } else {
        this.logger.warn('Homepage mode set to "page" without configured slug; falling back to landing mode.');
      }

      return {
        ...DEFAULT_HOMEPAGE_SETTINGS,
        selectedPage: null,
      };
    }

    return {
      mode,
      pageSlug: mode === 'page' && selectedPage ? selectedPage.slug : '',
      selectedPage:
        mode === 'page' && selectedPage
          ? { slug: selectedPage.slug, title: selectedPage.title }
          : null,
    };
  }

  private normalizePostsPageSettings(
    value: string | undefined,
    publishedPageMap: Map<string, { slug: string; title: string }>,
  ) {
    const parsed = this.parseJsonSetting<Partial<PostsPageSettings>>(value);
    const pageSlug = this.getString(parsed?.pageSlug, '');
    const type = parsed?.type === 'page' ? 'page' : 'default';
    const selectedPage = type === 'page' && pageSlug ? publishedPageMap.get(pageSlug) : null;

    if (!selectedPage) {
      return {
        type: 'default' as const,
        pageSlug: '',
        path: '/blog',
        title: 'Blog',
      };
    }

    return {
      type: 'page' as const,
      pageSlug: selectedPage.slug,
      path: `/${selectedPage.slug}`,
      title: selectedPage.title,
    };
  }

  private normalizeMenus(
    value: string | undefined,
    publishedPages: { slug: string; title: string }[],
    postsPage: { pageSlug: string; path: string; title: string },
    extensionPoints: SiteExtensionPoints,
  ) {
    const parsed = this.parseJsonSetting<{ header?: unknown; footer?: unknown }>(value);
    const reservedSlugs = new Set(['home']);
    if (postsPage.pageSlug) reservedSlugs.add(postsPage.pageSlug);

    const defaultMenuItems: SiteMenuItem[] = [
      { label: 'Home', href: '/' },
      { label: postsPage.title, href: postsPage.path },
      ...publishedPages
        .filter((page) => !reservedSlugs.has(page.slug))
        .map((page) => ({ label: page.title, href: `/${page.slug}` })),
    ];

    const header = this.normalizeMenuItems(parsed?.header);
    const footer = this.normalizeMenuItems(parsed?.footer);

    return {
      header: this.mergeMenuItems(
        header.length > 0 ? header : defaultMenuItems,
        extensionPoints.menu.header,
      ),
      footer: this.mergeMenuItems(
        footer.length > 0 ? footer : defaultMenuItems,
        extensionPoints.menu.footer,
      ),
    };
  }

  private normalizeExtensionPoints(value: string | undefined): SiteExtensionPoints {
    const parsed = this.parseJsonSetting<{ menu?: { header?: unknown; footer?: unknown } }>(value);
    const header = this.normalizeMenuItems(parsed?.menu?.header);
    const footer = this.normalizeMenuItems(parsed?.menu?.footer);

    return {
      menu: {
        header: header.length > 0 ? header : DEFAULT_SITE_EXTENSION_POINTS.menu.header,
        footer: footer.length > 0 ? footer : DEFAULT_SITE_EXTENSION_POINTS.menu.footer,
      },
    };
  }

  private normalizeHomepageBlocks(
    value: string | undefined,
    theme: SiteThemeSettings,
    postsPath: string,
  ): SiteHomepageBlock[] {
    const defaultBlocks: SiteHomepageBlock[] = [
      {
        id: 'featured_pages',
        type: 'featured_pages',
        enabled: theme.homepageSections.pages.enabled,
        title: theme.homepageSections.pages.title,
      },
      {
        id: 'latest_posts',
        type: 'latest_posts',
        enabled: theme.homepageSections.posts.enabled,
        title: theme.homepageSections.posts.title,
      },
      {
        id: 'cta_primary',
        type: 'cta',
        enabled: false,
        title: theme.heroTitle,
        body: theme.heroBody,
        primaryLabel: theme.heroPrimaryLabel,
        primaryHref: theme.heroPrimaryHref || postsPath,
        secondaryLabel: theme.heroSecondaryLabel,
        secondaryHref: theme.heroSecondaryHref,
      },
    ];

    const parsed = this.parseJsonSetting<unknown>(value);
    if (!Array.isArray(parsed)) return defaultBlocks;

    const blocks = parsed
      .map((item, index) => {
        if (!item || typeof item !== 'object') return null;
        const block = item as Record<string, unknown>;
        const id = this.getString(block.id, `block-${index + 1}`);
        const type = this.getString(block.type, '');
        const enabled = this.getBoolean(block.enabled, true);
        const title = this.getString(block.title, '');

        if (type === 'featured_pages') {
          return { id, type, enabled, title: title || theme.homepageSections.pages.title } satisfies SiteHomepageBlock;
        }
        if (type === 'latest_posts') {
          return { id, type, enabled, title: title || theme.homepageSections.posts.title } satisfies SiteHomepageBlock;
        }
        if (type === 'cta') {
          return {
            id,
            type,
            enabled,
            title: title || theme.heroTitle,
            body: this.getString(block.body, theme.heroBody),
            primaryLabel: this.getString(block.primaryLabel, theme.heroPrimaryLabel),
            primaryHref: this.getString(block.primaryHref, theme.heroPrimaryHref || postsPath),
            secondaryLabel: this.getString(block.secondaryLabel, theme.heroSecondaryLabel),
            secondaryHref: this.getString(block.secondaryHref, theme.heroSecondaryHref),
          } satisfies SiteHomepageBlock;
        }

        return null;
      })
      .filter((block): block is SiteHomepageBlock => block !== null);

    return blocks.length > 0 ? blocks : defaultBlocks;
  }

  private normalizeThemeSettings(value: string | undefined, postsPath: string): SiteThemeSettings {
    const parsed = this.parseJsonSetting<Partial<SiteThemeSettings>>(value);
    const homepageSections =
      parsed?.homepageSections && typeof parsed.homepageSections === 'object'
        ? parsed.homepageSections
        : null;
    const pageSection =
      homepageSections?.pages && typeof homepageSections.pages === 'object'
        ? homepageSections.pages
        : null;
    const postSection =
      homepageSections?.posts && typeof homepageSections.posts === 'object'
        ? homepageSections.posts
        : null;

    return {
      primaryColor: this.getString(parsed?.primaryColor, DEFAULT_SITE_THEME.primaryColor),
      accentColor: this.getString(parsed?.accentColor, DEFAULT_SITE_THEME.accentColor),
      fontFamily: this.getString(parsed?.fontFamily, DEFAULT_SITE_THEME.fontFamily),
      heroTitle: this.getString(parsed?.heroTitle, DEFAULT_SITE_THEME.heroTitle),
      heroBody: this.getString(parsed?.heroBody, DEFAULT_SITE_THEME.heroBody),
      heroPrimaryLabel: this.getString(parsed?.heroPrimaryLabel, DEFAULT_SITE_THEME.heroPrimaryLabel),
      heroPrimaryHref: this.getString(parsed?.heroPrimaryHref, postsPath),
      heroSecondaryLabel: this.getString(parsed?.heroSecondaryLabel, DEFAULT_SITE_THEME.heroSecondaryLabel),
      heroSecondaryHref: this.getString(parsed?.heroSecondaryHref, DEFAULT_SITE_THEME.heroSecondaryHref),
      homepageSections: {
        pages: {
          enabled: this.getBoolean(pageSection?.enabled, DEFAULT_SITE_THEME.homepageSections.pages.enabled),
          title: this.getString(pageSection?.title, DEFAULT_SITE_THEME.homepageSections.pages.title),
        },
        posts: {
          enabled: this.getBoolean(postSection?.enabled, DEFAULT_SITE_THEME.homepageSections.posts.enabled),
          title: this.getString(postSection?.title, DEFAULT_SITE_THEME.homepageSections.posts.title),
        },
      },
    };
  }

  private applyCmsThemeStyles(theme: SiteThemeSettings, value: Prisma.JsonValue | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return theme;
    const styles = value as Record<string, unknown>;
    return {
      ...theme,
      primaryColor: this.getString(styles.primaryColor, theme.primaryColor),
      accentColor: this.getString(styles.accentColor, theme.accentColor),
      fontFamily: this.getString(styles.fontFamily, theme.fontFamily),
      heroTitle: this.getString(styles.heroTitle, theme.heroTitle),
      heroBody: this.getString(styles.heroBody, theme.heroBody),
      heroPrimaryLabel: this.getString(styles.heroPrimaryLabel, theme.heroPrimaryLabel),
      heroPrimaryHref: this.getString(styles.heroPrimaryHref, theme.heroPrimaryHref),
      heroSecondaryLabel: this.getString(styles.heroSecondaryLabel, theme.heroSecondaryLabel),
      heroSecondaryHref: this.getString(styles.heroSecondaryHref, theme.heroSecondaryHref),
    };
  }

  private getThemePageLayout(value: Prisma.JsonValue | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const pageTypes = (value as Record<string, unknown>).pageTypes;
    if (!pageTypes || typeof pageTypes !== 'object' || Array.isArray(pageTypes)) return null;
    const pageLayout = (pageTypes as Record<string, unknown>).page;
    if (!pageLayout || typeof pageLayout !== 'object' || Array.isArray(pageLayout)) return null;
    return Array.isArray((pageLayout as Record<string, unknown>).sections) ? pageLayout : null;
  }

  private normalizeMenuItems(value: unknown): SiteMenuItem[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const label = this.getString((item as { label?: unknown }).label, '');
        const href = this.getString(
          (item as { href?: unknown; url?: unknown }).href ?? (item as { url?: unknown }).url,
          '',
        );

        if (!label || !href) return null;
        return { label, href };
      })
      .filter((item): item is SiteMenuItem => item !== null);
  }

  private mergeMenuItems(baseItems: SiteMenuItem[], extensionItems: SiteMenuItem[]) {
    const merged = [...baseItems];
    const seen = new Set(baseItems.map((item) => `${item.label.toLowerCase()}::${item.href.toLowerCase()}`));

    for (const item of extensionItems) {
      const key = `${item.label.toLowerCase()}::${item.href.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }

    return merged;
  }

  private parseJsonSetting<T>(value?: string): T | null {
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  private getString(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim();
    return normalized || fallback;
  }

  private getBoolean(value: unknown, fallback: boolean) {
    return typeof value === 'boolean' ? value : fallback;
  }

  private getPublishedPostWhere(query: PostQuery): Prisma.PostWhereInput {
    const now = new Date();
    const publishedAtRange = this.getPublishedAtRange(now, query.year, query.month);
    const search = query.search?.trim();

    return {
      publishedAt: publishedAtRange,
      ...(query.categorySlug ? { categories: { some: { slug: query.categorySlug } } } : {}),
      ...(query.tagSlug ? { tags: { some: { slug: query.tagSlug } } } : {}),
      ...(query.authorId ? { authorId: query.authorId } : {}),
      ...(search
        ? {
            OR: [
              // Keep search lightweight for now: title/excerpt checks are cheaper than scanning full HTML body content,
              // which avoids broad content-table scans until a dedicated full-text strategy is added.
              { title: { contains: search, mode: 'insensitive' } },
              { excerpt: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private getPublishedAtRange(now: Date, year?: string, month?: string): Prisma.DateTimeNullableFilter {
    const maxArchiveYear = now.getUTCFullYear() + MAX_ARCHIVE_YEARS_AHEAD;
    const parsedYear = Number.parseInt(year ?? '', 10);
    const parsedMonth = Number.parseInt(month ?? '', 10);

    if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
      return { not: null, lte: now };
    }

    if (parsedMonth < 1 || parsedMonth > 12 || parsedYear < MIN_ARCHIVE_YEAR || parsedYear > maxArchiveYear) {
      return { not: null, lte: now };
    }

    const from = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1, 0, 0, 0));
    const to = new Date(Date.UTC(parsedYear, parsedMonth, 1, 0, 0, 0));

    return {
      not: null,
      gte: from,
      lt: to,
      lte: now,
    };
  }

  private async findPublishedRedirectTarget(contentType: 'PAGE' | 'POST', slug: string) {
    const visited = new Set([slug]);
    let currentSlug = slug;

    for (let depth = 0; depth < MAX_REDIRECT_DEPTH; depth += 1) {
      const redirect = await this.prisma.slugRedirect.findUnique({
        where: {
          contentType_sourceSlug: {
            contentType,
            sourceSlug: currentSlug,
          },
        },
        select: {
          targetSlug: true,
        },
      });

      if (!redirect || visited.has(redirect.targetSlug)) return null;

      const publishedPath = await this.findPublishedContentPath(contentType, redirect.targetSlug);
      if (publishedPath) return publishedPath;

      visited.add(redirect.targetSlug);
      currentSlug = redirect.targetSlug;
    }

    return null;
  }

  private async findPublishedContentPath(contentType: 'PAGE' | 'POST', slug: string) {
    const now = new Date();

    if (contentType === 'PAGE') {
      const page = await this.prisma.page.findFirst({
        where: {
          slug,
          publishedAt: { not: null, lte: now },
        },
        select: { slug: true },
      });
      return page ? `/${page.slug}` : null;
    }

    const post = await this.prisma.post.findFirst({
      where: {
        slug,
        publishedAt: { not: null, lte: now },
      },
      select: { slug: true },
    });
    return post ? `/blog/${post.slug}` : null;
  }
}
