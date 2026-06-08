const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
const CMS_REVALIDATE_SECONDS = 60;

export interface SiteMenuItem {
  label: string;
  href: string;
}

export interface PublicSiteConfig {
  identity: {
    title: string;
    tagline: string;
    logoUrl: string;
    footerText: string;
  };
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
  theme: {
    primaryColor: string;
    accentColor: string;
    heroTitle: string;
    heroBody: string;
    heroPrimaryLabel: string;
    heroPrimaryHref: string;
    heroSecondaryLabel: string;
    heroSecondaryHref: string;
    homepageSections: {
      pages: {
        enabled: boolean;
        title: string;
      };
      posts: {
        enabled: boolean;
        title: string;
      };
    };
  };
}

const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  identity: {
    title: 'Psychic Link CMS',
    tagline: 'Public CMS frontend powered by published content.',
    logoUrl: '',
    footerText: 'Browse published pages and blog posts managed in the CMS.',
  },
  homepage: {
    mode: 'landing',
    pageSlug: '',
    selectedPage: null,
  },
  postsPage: {
    type: 'default',
    pageSlug: '',
    path: '/blog',
    title: 'Blog',
  },
  menus: {
    header: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' },
    ],
    footer: [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  theme: {
    primaryColor: '#4f46e5',
    accentColor: '#7c3aed',
    heroTitle: 'Psychic Link CMS',
    heroBody: 'Welcome to the public site. Read our latest posts or browse CMS pages.',
    heroPrimaryLabel: 'Visit Blog',
    heroPrimaryHref: '',
    heroSecondaryLabel: 'Admin',
    heroSecondaryHref: '/admin',
    homepageSections: {
      pages: {
        enabled: true,
        title: 'Browse Pages',
      },
      posts: {
        enabled: true,
        title: 'Latest Posts',
      },
    },
  },
};

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  featuredImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
}

export interface TaxonomyItem {
  id: string;
  slug: string;
  name: string;
}

export interface TaxonomySummary extends TaxonomyItem {
  postCount: number;
}

export interface AuthorSummary {
  id: string;
  name: string;
  postCount: number;
}

export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  featuredImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  author: { id: string; name: string };
  categories: TaxonomyItem[];
  tags: TaxonomyItem[];
}

export interface ArchiveSummary {
  key: string;
  year: number;
  month: number;
  count: number;
}

interface GetPostsFilters {
  search?: string;
  category?: string;
  tag?: string;
  authorId?: string;
  year?: string;
  month?: string;
}

function logCmsFetchError(path: string, status?: number) {
  console.error(`[public-cms] Failed request to ${path}${status ? ` (status ${status})` : ''}`);
}

export { toPlainText } from './cms';

export function getSafeImageSrc(value?: string | null) {
  const src = value?.trim();
  if (!src) return null;
  if (src.startsWith('/')) return src;

  try {
    const parsed = new URL(src);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? src : null;
  } catch {
    return null;
  }
}

async function fetchCmsJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return fallback;
    }
    return res.json() as Promise<T>;
  } catch {
    logCmsFetchError(path);
    return fallback;
  }
}

export async function getPublishedPages(excludeSlug?: string): Promise<PublicPage[]> {
  const params = new URLSearchParams();
  if (excludeSlug) params.set('excludeSlug', excludeSlug);
  const path = `/public/pages${params.size > 0 ? `?${params.toString()}` : ''}`;
  return fetchCmsJson(path, []);
}

export async function getPublicSiteConfig(): Promise<PublicSiteConfig> {
  return fetchCmsJson('/public/site-config', DEFAULT_PUBLIC_SITE_CONFIG);
}

export async function getPublishedPage(slug: string): Promise<PublicPage | null> {
  const path = `/public/pages/${encodeURIComponent(slug)}`;
  return fetchCmsJson(path, null);
}

export async function getPublishedPosts(filters: GetPostsFilters = {}): Promise<PublicPost[]> {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.category) params.set('category', filters.category);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.authorId) params.set('authorId', filters.authorId);
  if (filters.year) params.set('year', filters.year);
  if (filters.month) params.set('month', filters.month);

  const path = `/public/posts${params.size > 0 ? `?${params.toString()}` : ''}`;
  return fetchCmsJson(path, []);
}

export async function getPublishedPost(slug: string): Promise<PublicPost | null> {
  const path = `/public/posts/${encodeURIComponent(slug)}`;
  return fetchCmsJson(path, null);
}

export async function getRelatedPosts(slug: string): Promise<PublicPost[]> {
  const path = `/public/posts/${encodeURIComponent(slug)}/related`;
  return fetchCmsJson(path, []);
}

export async function getCategories(): Promise<TaxonomySummary[]> {
  return fetchCmsJson('/public/categories', []);
}

export async function getCategoryPosts(slug: string): Promise<{ category: TaxonomyItem; posts: PublicPost[] } | null> {
  const path = `/public/categories/${encodeURIComponent(slug)}/posts`;
  return fetchCmsJson(path, null);
}

export async function getTags(): Promise<TaxonomySummary[]> {
  return fetchCmsJson('/public/tags', []);
}

export async function getTagPosts(slug: string): Promise<{ tag: TaxonomyItem; posts: PublicPost[] } | null> {
  const path = `/public/tags/${encodeURIComponent(slug)}/posts`;
  return fetchCmsJson(path, null);
}

export async function getAuthors(): Promise<AuthorSummary[]> {
  return fetchCmsJson('/public/authors', []);
}

export async function getAuthorPosts(authorId: string): Promise<{ author: { id: string; name: string }; posts: PublicPost[] } | null> {
  const path = `/public/authors/${encodeURIComponent(authorId)}/posts`;
  return fetchCmsJson(path, null);
}

export async function getArchives(): Promise<ArchiveSummary[]> {
  return fetchCmsJson('/public/archives', []);
}
