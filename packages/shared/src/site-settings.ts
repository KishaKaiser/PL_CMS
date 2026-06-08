export type SiteMenuItem = {
  label: string;
  href: string;
};

export type ThemeSectionSettings = {
  enabled: boolean;
  title: string;
};

export type SiteThemeSettings = {
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

export type SiteIdentitySettings = {
  title: string;
  tagline: string;
  logoUrl: string;
  footerText: string;
};

export type HomepageSettings = {
  mode: 'landing' | 'latest_posts' | 'page';
  pageSlug: string;
};

export type PostsPageSettings = {
  type: 'default' | 'page';
  pageSlug: string;
};

export type SiteHomepageBlock =
  | {
      id: string;
      type: 'featured_pages';
      enabled: boolean;
      title: string;
    }
  | {
      id: string;
      type: 'latest_posts';
      enabled: boolean;
      title: string;
    }
  | {
      id: string;
      type: 'cta';
      enabled: boolean;
      title: string;
      body: string;
      primaryLabel: string;
      primaryHref: string;
      secondaryLabel: string;
      secondaryHref: string;
    };

export type SiteExtensionPoints = {
  menu: {
    header: SiteMenuItem[];
    footer: SiteMenuItem[];
  };
};

export const SITE_SETTING_KEYS = {
  SITE_NAME: 'site_name',
  SITE_IDENTITY: 'site_identity',
  SITE_HOMEPAGE: 'site_homepage',
  SITE_POSTS_PAGE: 'site_posts_page',
  SITE_MENUS: 'site_menus',
  SITE_THEME: 'site_theme',
  SITE_HOMEPAGE_BLOCKS: 'site_homepage_blocks',
  SITE_EXTENSION_POINTS: 'site_extension_points',
} as const;

export const PUBLIC_SITE_SETTING_KEYS = [
  SITE_SETTING_KEYS.SITE_NAME,
  SITE_SETTING_KEYS.SITE_IDENTITY,
  SITE_SETTING_KEYS.SITE_HOMEPAGE,
  SITE_SETTING_KEYS.SITE_POSTS_PAGE,
  SITE_SETTING_KEYS.SITE_MENUS,
  SITE_SETTING_KEYS.SITE_THEME,
  SITE_SETTING_KEYS.SITE_HOMEPAGE_BLOCKS,
  SITE_SETTING_KEYS.SITE_EXTENSION_POINTS,
] as const;

const DEFAULT_SITE_TITLE = 'Psychic Link CMS';
const DEFAULT_SITE_TAGLINE = 'Public CMS frontend powered by published content.';
const DEFAULT_FOOTER_TEXT = 'Browse published pages and blog posts managed in the CMS.';

export const DEFAULT_HOMEPAGE_SETTINGS: HomepageSettings = {
  mode: 'landing',
  pageSlug: '',
};

export const DEFAULT_POSTS_PAGE_SETTINGS: PostsPageSettings = {
  type: 'default',
  pageSlug: '',
};

export const DEFAULT_SITE_THEME: SiteThemeSettings = {
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

export const DEFAULT_SITE_IDENTITY: SiteIdentitySettings = {
  title: DEFAULT_SITE_TITLE,
  tagline: DEFAULT_SITE_TAGLINE,
  logoUrl: '',
  footerText: DEFAULT_FOOTER_TEXT,
};

export const DEFAULT_SITE_MENUS = {
  header: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
  ],
  footer: [
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog' },
  ],
} satisfies { header: SiteMenuItem[]; footer: SiteMenuItem[] };

export const DEFAULT_SITE_EXTENSION_POINTS: SiteExtensionPoints = {
  menu: {
    header: [],
    footer: [],
  },
};

export function buildDefaultHomepageBlocks(postsPath = '/blog'): SiteHomepageBlock[] {
  return [
    {
      id: 'featured_pages',
      type: 'featured_pages',
      enabled: DEFAULT_SITE_THEME.homepageSections.pages.enabled,
      title: DEFAULT_SITE_THEME.homepageSections.pages.title,
    },
    {
      id: 'latest_posts',
      type: 'latest_posts',
      enabled: DEFAULT_SITE_THEME.homepageSections.posts.enabled,
      title: DEFAULT_SITE_THEME.homepageSections.posts.title,
    },
    {
      id: 'cta_primary',
      type: 'cta',
      enabled: false,
      title: DEFAULT_SITE_THEME.heroTitle,
      body: DEFAULT_SITE_THEME.heroBody,
      primaryLabel: DEFAULT_SITE_THEME.heroPrimaryLabel,
      primaryHref: postsPath,
      secondaryLabel: DEFAULT_SITE_THEME.heroSecondaryLabel,
      secondaryHref: DEFAULT_SITE_THEME.heroSecondaryHref,
    },
  ];
}
