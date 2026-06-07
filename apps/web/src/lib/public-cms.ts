const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';
const CMS_REVALIDATE_SECONDS = 60;

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  featuredImageUrl: string | null;
  publishedAt: string;
  updatedAt: string;
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
}

function logCmsFetchError(path: string, status?: number) {
  console.error(`[public-cms] Failed request to ${path}${status ? ` (status ${status})` : ''}`);
}

export { toPlainText } from './cms';

export async function getPublishedPages(excludeSlug?: string): Promise<PublicPage[]> {
  const params = new URLSearchParams();
  if (excludeSlug) params.set('excludeSlug', excludeSlug);
  const path = `/public/pages${params.size > 0 ? `?${params.toString()}` : ''}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return [];
    }
    return res.json() as Promise<PublicPage[]>;
  } catch {
    logCmsFetchError(path);
    return [];
  }
}

export async function getPublishedPage(slug: string): Promise<PublicPage | null> {
  const path = `/public/pages/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return null;
    }
    return res.json() as Promise<PublicPage>;
  } catch {
    logCmsFetchError(path);
    return null;
  }
}

export async function getPublishedPosts(): Promise<PublicPost[]> {
  const path = '/public/posts';
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return [];
    }
    return res.json() as Promise<PublicPost[]>;
  } catch {
    logCmsFetchError(path);
    return [];
  }
}

export async function getPublishedPost(slug: string): Promise<PublicPost | null> {
  const path = `/public/posts/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CMS_REVALIDATE_SECONDS } });
    if (!res.ok) {
      logCmsFetchError(path, res.status);
      return null;
    }
    return res.json() as Promise<PublicPost>;
  } catch {
    logCmsFetchError(path);
    return null;
  }
}
