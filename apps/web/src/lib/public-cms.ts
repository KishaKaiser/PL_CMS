const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/api';

export interface PublicPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
}

export interface PublicPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  publishedAt: string;
  updatedAt: string;
  author: { id: string; name: string };
}

export async function getPublishedPage(slug: string): Promise<PublicPage | null> {
  try {
    const res = await fetch(`${API_BASE}/public/pages/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<PublicPage>;
  } catch {
    return null;
  }
}

export async function getPublishedPosts(): Promise<PublicPost[]> {
  try {
    const res = await fetch(`${API_BASE}/public/posts`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json() as Promise<PublicPost[]>;
  } catch {
    return [];
  }
}

export async function getPublishedPost(slug: string): Promise<PublicPost | null> {
  try {
    const res = await fetch(`${API_BASE}/public/posts/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<PublicPost>;
  } catch {
    return null;
  }
}
