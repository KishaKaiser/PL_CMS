import {
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_POSTS_PAGE_SETTINGS,
  DEFAULT_SITE_EXTENSION_POINTS,
  DEFAULT_SITE_IDENTITY,
  DEFAULT_SITE_MENUS,
  DEFAULT_SITE_THEME,
  buildDefaultHomepageBlocks,
  type HomepageSettings,
  type SiteExtensionPoints,
  type SiteHomepageBlock,
  type SiteIdentitySettings,
  type SiteMenuItem,
  type SiteThemeSettings,
} from '@pl-cms/shared';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
const CMS_REVALIDATE_SECONDS = 60;
const CMS_REQUEST_TIMEOUT_MS = 5000;

export interface PublicSiteConfig {
  identity: SiteIdentitySettings;
  homepage: HomepageSettings & {
    selectedPage: { slug: string; title: string } | null;
  };
  postsPage: typeof DEFAULT_POSTS_PAGE_SETTINGS & {
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
}

const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  identity: DEFAULT_SITE_IDENTITY,
  homepage: {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    selectedPage: null,
  },
  postsPage: {
    ...DEFAULT_POSTS_PAGE_SETTINGS,
    path: '/blog',
    title: 'Blog',
  },
  menus: DEFAULT_SITE_MENUS,
  theme: { ...DEFAULT_SITE_THEME, heroPrimaryHref: '/blog' },
  homepageBlocks: buildDefaultHomepageBlocks('/blog'),
  extensionPoints: DEFAULT_SITE_EXTENSION_POINTS,
};

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  content: string;
  featuredImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
  builderLayout?: BuilderLayout | null;
}

export interface BuilderBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BuilderBlock[];
}

export interface BuilderLayout {
  version: number;
  type: string;
  settings?: {
    layout?: string;
    breadcrumbs?: boolean;
    showTitle?: boolean;
  };
  sections: Array<{
    id: string;
    type: string;
    settings: Record<string, unknown>;
    blocks: BuilderBlock[];
  }>;
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
  metaTitle: string | null;
  metaDescription: string | null;
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

interface RedirectLookup {
  redirectTo: string | null;
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

async function readJsonResponse<T>(res: Response, fallback: T): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CMS_REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: CMS_REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return fallback;
    }
    return await readJsonResponse(res, fallback);
  } catch {
    logCmsFetchError(path);
    return fallback;
  } finally {
    clearTimeout(timeoutId);
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

export async function resolvePageRedirect(slug: string): Promise<string | null> {
  const path = `/public/pages/${encodeURIComponent(slug)}/redirect`;
  const result = await fetchCmsJson<RedirectLookup>(path, { redirectTo: null });
  return result.redirectTo;
}

export async function resolvePostRedirect(slug: string): Promise<string | null> {
  const path = `/public/posts/${encodeURIComponent(slug)}/redirect`;
  const result = await fetchCmsJson<RedirectLookup>(path, { redirectTo: null });
  return result.redirectTo;
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
