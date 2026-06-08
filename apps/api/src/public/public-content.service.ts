import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@pl-cms/db';
import { PrismaService } from '../prisma/prisma.service';

type PostQuery = {
  search?: string;
  categorySlug?: string;
  tagSlug?: string;
  authorId?: string;
  year?: string;
  month?: string;
};

type SiteMenuItem = {
  label: string;
  href: string;
};

type ThemeSectionSettings = {
  enabled: boolean;
  title: string;
};

type SiteThemeSettings = {
  primaryColor: string;
  accentColor: string;
  heroTitle: string;
  heroBody: string;
  heroPrimaryLabel: string;
  heroPrimaryHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  homepageSections: {
    pages: ThemeSectionSettings;
    posts: ThemeSectionSettings;
  };
};

type SiteIdentitySettings = {
  title: string;
  tagline: string;
  logoUrl: string;
  footerText: string;
};

type HomepageSettings = {
  mode: 'landing' | 'latest_posts' | 'page';
  pageSlug: string;
};

type PostsPageSettings = {
  type: 'default' | 'page';
  pageSlug: string;
};

const PUBLIC_SITE_SETTING_KEYS = [
  'site_name',
  'site_identity',
  'site_homepage',
  'site_posts_page',
  'site_menus',
  'site_theme',
] as const;

const DEFAULT_SITE_TITLE = 'Psychic Link CMS';
const DEFAULT_SITE_TAGLINE = 'Public CMS frontend powered by published content.';
const DEFAULT_FOOTER_TEXT = 'Browse published pages and blog posts managed in the CMS.';

const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  mode: 'landing',
  pageSlug: '',
};

const DEFAULT_SITE_THEME: SiteThemeSettings = {
  primaryColor: '#4f46e5',
  accentColor: '#7c3aed',
  heroTitle: DEFAULT_SITE_TITLE,
  heroBody: 'Welcome to the public site. Read our latest posts or browse CMS pages.',
  heroPrimaryLabel: 'Visit Blog',
  heroPrimaryHref: '',
  heroSecondaryLabel: 'Admin',
  heroSecondaryHref: '/admin',
  homepageSections: {
    pages: { enabled: true, title: 'Browse Pages' },
    posts: { enabled: true, title: 'Latest Posts' },
  },
};

const DEFAULT_SITE_IDENTITY: SiteIdentitySettings = {
  title: DEFAULT_SITE_TITLE,
  tagline: DEFAULT_SITE_TAGLINE,
  logoUrl: '',
  footerText: DEFAULT_FOOTER_TEXT,
};

const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
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

@Injectable()
export class PublicContentService {
  private readonly logger = new Logger(PublicContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSiteConfig() {
    const now = new Date();
    const [settings, publishedPages] = await Promise.all([
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
    ]);

    const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));
    const publishedPageMap = new Map(publishedPages.map((page) => [page.slug, page]));

    const identity = this.normalizeIdentitySettings(settingMap);
    const homepage = this.normalizeHomepageSettings(
      settingMap.get('site_homepage'),
      publishedPageMap,
    );
    const postsPage = this.normalizePostsPageSettings(
      settingMap.get('site_posts_page'),
      publishedPageMap,
    );
    const theme = this.normalizeThemeSettings(settingMap.get('site_theme'), postsPage.path);
    const menus = this.normalizeMenus(
      settingMap.get('site_menus'),
      publishedPages,
      postsPage,
    );

    return {
      identity,
      homepage,
      postsPage,
      menus,
      theme,
    };
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
        content: true,
        featuredImageUrl: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    if (!page) throw new NotFoundException(`Page ${slug} not found`);
    return page;
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
    const identityValue = this.parseJsonSetting<Partial<SiteIdentitySettings>>(settingMap.get('site_identity'));
    const fallbackTitle = settingMap.get('site_name')?.trim() || DEFAULT_SITE_IDENTITY.title;

    return {
      title: this.getString(identityValue?.title, fallbackTitle),
      tagline: this.getString(identityValue?.tagline, DEFAULT_SITE_IDENTITY.tagline),
      logoUrl: this.getString(identityValue?.logoUrl, DEFAULT_SITE_IDENTITY.logoUrl),
      footerText: this.getString(identityValue?.footerText, DEFAULT_SITE_IDENTITY.footerText),
    };
  }

  private normalizeHomepageSettings(
    value: string | undefined,
    publishedPageMap: Map<string, { slug: string; title: string }>,
  ) {
    const parsed = this.parseJsonSetting<Partial<HomepageSettings>>(value);
    const pageSlug = this.getString(parsed?.pageSlug, '');
    const mode = parsed?.mode === 'page' || parsed?.mode === 'latest_posts' ? parsed.mode : 'landing';
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
      header: header.length > 0 ? header : defaultMenuItems,
      footer: footer.length > 0 ? footer : defaultMenuItems,
    };
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
}
