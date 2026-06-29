import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@pl-cms/db';
import {
  DEFAULT_SITE_EXTENSION_POINTS,
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_SITE_IDENTITY,
  DEFAULT_SITE_MENUS,
  DEFAULT_SITE_THEME,
  SITE_SETTING_KEYS,
  buildDefaultHomepageBlocks,
} from '@pl-cms/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_THEME_SLUG = 'basic-default';

const DEFAULT_PAGE_LAYOUT = {
  version: 1,
  type: 'page',
  settings: {
    layout: 'full',
    breadcrumbs: true,
    showTitle: true,
  },
  sections: [
    {
      id: 'section-hero',
      type: 'section',
      settings: { layout: 'full', background: '#ffffff', padding: '72px 32px' },
      blocks: [
        {
          id: 'heading-default',
          type: 'heading',
          props: { text: 'Welcome to Psychic Link CMS', level: 1, align: 'center', fontSize: 48 },
        },
        {
          id: 'text-default',
          type: 'text',
          props: {
            text: 'A clean starter theme with global page templates and store-ready widgets.',
            align: 'center',
            fontSize: 18,
          },
        },
      ],
    },
  ],
};

const DEFAULT_THEME = {
  name: 'Basic Default',
  slug: DEFAULT_THEME_SLUG,
  version: '1.0.0',
  description: 'Clean starter theme for all pages until another theme is activated.',
  globalStyles: {
    primaryColor: '#6f21b6',
    accentColor: '#0f766e',
    fontFamily: 'Inter, Arial, sans-serif',
    heroTitle: 'Psychic Link CMS',
    heroBody: 'A clean default CMS theme ready for pages, posts, and builder layouts.',
  },
  templates: {
    header: {
      version: 1,
      type: 'header',
      sections: [
        {
          id: 'header-main',
          type: 'section',
          settings: { layout: 'contained', background: '#ffffff', padding: '20px 32px' },
          blocks: [
            {
              id: 'header-title',
              type: 'heading',
              props: { text: 'Psychic Link CMS', level: 2, fontSize: 24, align: 'left' },
            },
          ],
        },
      ],
    },
    footer: {
      version: 1,
      type: 'footer',
      sections: [
        {
          id: 'footer-main',
          type: 'section',
          settings: { layout: 'contained', background: '#f9fafb', padding: '32px' },
          blocks: [
            {
              id: 'footer-text',
              type: 'text',
              props: { text: 'Powered by Psychic Link CMS', align: 'center', fontSize: 14 },
            },
          ],
        },
      ],
    },
    pageTypes: {
      page: DEFAULT_PAGE_LAYOUT,
      post: { ...DEFAULT_PAGE_LAYOUT, type: 'post' },
      archive: { ...DEFAULT_PAGE_LAYOUT, type: 'archive', settings: { layout: 'full', breadcrumbs: true } },
    },
  },
  components: { widgets: ['heading', 'text', 'image', 'button', 'columns', 'product-grid', 'product-categories', 'product-tags'] },
  widgetRegistry: ['heading', 'text', 'image', 'button', 'columns', 'product-grid', 'product-categories', 'product-tags'],
  schemaJson: { builderVersion: 1, supports: ['global-theme', 'pages', 'headers', 'footers', 'store-widgets'] },
};

const DEFAULT_PAGES = [
  {
    slug: 'home',
    title: 'Home',
    content: '<p>Welcome to Psychic Link CMS.</p>',
  },
  {
    slug: 'shop',
    title: 'Shop',
    content: '<p>Browse available products and services.</p>',
  },
  {
    slug: 'cart',
    title: 'Cart',
    content: '<p>Review items before checkout.</p>',
  },
  {
    slug: 'checkout',
    title: 'Checkout',
    content: '<p>Complete your order securely.</p>',
  },
  {
    slug: 'account',
    title: 'Account',
    content: '<p>Manage your account details.</p>',
  },
  {
    slug: 'client',
    title: 'Client Dashboard',
    content: '<p>View orders, messages, wallet, and account details.</p>',
  },
  {
    slug: 'advisor',
    title: 'Advisor Dashboard',
    content: '<p>Manage advisor profile, payouts, messages, and call transactions.</p>',
  },
  {
    slug: 'blog',
    title: 'Blog',
    content: '<p>Read latest posts and updates.</p>',
  },
] as const;

@Injectable()
export class DefaultContentService implements OnModuleInit {
  private readonly logger = new Logger(DefaultContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaults();
    } catch (error) {
      this.logger.warn(`Default content bootstrap skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async ensureDefaults() {
    await this.ensureSettings();
    await this.ensureModules();
    const theme = await this.ensureDefaultTheme();
    await this.ensureDefaultPages(theme.id);
    return {
      themeSlug: DEFAULT_THEME.slug,
      pages: DEFAULT_PAGES.map((page) => page.slug),
    };
  }

  private async ensureSettings() {
    const settings = [
      { key: SITE_SETTING_KEYS.SITE_NAME, value: DEFAULT_SITE_IDENTITY.title },
      { key: SITE_SETTING_KEYS.SITE_IDENTITY, value: JSON.stringify(DEFAULT_SITE_IDENTITY) },
      { key: SITE_SETTING_KEYS.SITE_HOMEPAGE, value: JSON.stringify(DEFAULT_HOMEPAGE_SETTINGS) },
      { key: SITE_SETTING_KEYS.SITE_POSTS_PAGE, value: JSON.stringify({ type: 'page', pageSlug: 'blog' }) },
      { key: SITE_SETTING_KEYS.SITE_MENUS, value: JSON.stringify(DEFAULT_SITE_MENUS) },
      { key: SITE_SETTING_KEYS.SITE_THEME, value: JSON.stringify(DEFAULT_SITE_THEME) },
      { key: SITE_SETTING_KEYS.SITE_HOMEPAGE_BLOCKS, value: JSON.stringify(buildDefaultHomepageBlocks('/blog')) },
      { key: SITE_SETTING_KEYS.SITE_EXTENSION_POINTS, value: JSON.stringify(DEFAULT_SITE_EXTENSION_POINTS) },
    ];

    for (const setting of settings) {
      await this.prisma.setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }
  }

  private async ensureModules() {
    await this.prisma.module.upsert({
      where: { name: 'newsletter' },
      update: {},
      create: { name: 'newsletter', version: '1.0.0', enabled: true },
    });
  }

  private async ensureDefaultTheme() {
    const activeTheme = await this.prisma.cmsTheme.findFirst({ where: { isActive: true }, select: { id: true } });
    const theme = await this.prisma.cmsTheme.upsert({
      where: { slug: DEFAULT_THEME.slug },
      update: {
        templates: DEFAULT_THEME.templates as Prisma.InputJsonObject,
        components: DEFAULT_THEME.components as Prisma.InputJsonObject,
        widgetRegistry: DEFAULT_THEME.widgetRegistry as Prisma.InputJsonArray,
        schemaJson: DEFAULT_THEME.schemaJson as Prisma.InputJsonObject,
        ...(activeTheme ? {} : { isActive: true }),
      },
      create: {
        name: DEFAULT_THEME.name,
        slug: DEFAULT_THEME.slug,
        version: DEFAULT_THEME.version,
        description: DEFAULT_THEME.description,
        isActive: !activeTheme,
        globalStyles: DEFAULT_THEME.globalStyles as Prisma.InputJsonObject,
        templates: DEFAULT_THEME.templates as Prisma.InputJsonObject,
        components: DEFAULT_THEME.components as Prisma.InputJsonObject,
        widgetRegistry: DEFAULT_THEME.widgetRegistry as Prisma.InputJsonArray,
        schemaJson: DEFAULT_THEME.schemaJson as Prisma.InputJsonObject,
      },
      select: { id: true },
    });

    return theme;
  }

  private async ensureDefaultPages(themeId: string) {
    const publishedAt = new Date();
    for (const page of DEFAULT_PAGES) {
      await this.prisma.page.upsert({
        where: { slug: page.slug },
        update: {},
        create: {
          ...page,
          metaTitle: page.title,
          metaDescription: `${page.title} page`,
          cmsThemeId: themeId,
          publishedAt,
        },
      });
    }
  }
}
