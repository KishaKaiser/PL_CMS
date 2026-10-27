import type { MetadataRoute } from 'next';
import {
  getArchives,
  getAuthors,
  getCategories,
  getPublishedPages,
  getPublishedPosts,
  getPublicSiteConfig,
  getTags,
} from '../lib/public-cms';
import { fetchApi } from '../lib/server-api';
import { toAbsoluteUrl } from '../lib/seo';

/** The shop's products that are on sale (the API leaves out inactive and hidden ones). */
async function getShopProducts(): Promise<Array<{ id: string; slug?: string | null; updatedAt?: string; customizeHref?: string | null }>> {
  try {
    const res = await fetchApi('/products', { cache: 'no-store' });
    if (!res.ok) return [];
    return (await res.json()) as Array<{ id: string; slug?: string | null; updatedAt?: string; customizeHref?: string | null }>;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [siteConfig, pages, posts, categories, tags, authors, archives, products] = await Promise.all([
    getPublicSiteConfig(),
    getPublishedPages(),
    getPublishedPosts(),
    getCategories(),
    getTags(),
    getAuthors(),
    getArchives(),
    getShopProducts(),
  ]);

  const entries = new Map<string, MetadataRoute.Sitemap[number]>();

  const addEntry = (
    path: string,
    options: Omit<MetadataRoute.Sitemap[number], 'url'> = {},
  ) => {
    const url = toAbsoluteUrl(path);
    if (!url) return;
    entries.set(path, { url, ...options });
  };

  addEntry('/', { changeFrequency: 'daily', priority: 1 });
  addEntry(siteConfig.postsPage.path, { changeFrequency: 'daily', priority: 0.9 });
  addEntry('/blog/archive', { changeFrequency: 'weekly', priority: 0.5 });

  addEntry('/shop', { changeFrequency: 'daily', priority: 0.9 });

  for (const product of products) {
    // The custom candle has no product page of its own: its entry is the builder.
    addEntry(product.customizeHref || `/shop/${product.slug || product.id}`, {
      lastModified: product.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const page of pages) {
    if (page.slug === 'home' || page.slug === siteConfig.postsPage.pageSlug) continue;
    addEntry(`/${page.slug}`, {
      lastModified: page.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const post of posts) {
    addEntry(`/blog/${post.slug}`, {
      lastModified: post.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const category of categories) {
    addEntry(`/blog/categories/${category.slug}`, {
      changeFrequency: 'weekly',
      priority: 0.5,
    });
  }

  for (const tag of tags) {
    addEntry(`/blog/tags/${tag.slug}`, {
      changeFrequency: 'weekly',
      priority: 0.4,
    });
  }

  for (const author of authors) {
    addEntry(`/blog/authors/${author.id}`, {
      changeFrequency: 'weekly',
      priority: 0.4,
    });
  }

  for (const archive of archives) {
    addEntry(`/blog/archive/${archive.year}/${String(archive.month).padStart(2, '0')}`, {
      changeFrequency: 'monthly',
      priority: 0.3,
    });
  }

  return Array.from(entries.values());
}
