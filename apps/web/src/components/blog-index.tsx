import Link from 'next/link';
import { PublicSiteShell } from './public-site-shell';
import {
  getPublishedPosts,
  getPublicSiteConfig,
  getSafeImageSrc,
  type PublicSiteConfig,
  toPlainText,
} from '../lib/public-cms';

const BLOG_EXCERPT_LENGTH = 180;

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  searchParams?: SearchParams;
  basePath?: string;
  heading?: string;
  description?: string;
  siteConfig?: PublicSiteConfig;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function BlogIndex({
  searchParams = {},
  basePath,
  heading,
  description,
  siteConfig,
}: Props) {
  const config = siteConfig ?? (await getPublicSiteConfig());
  const blogPath = basePath ?? config.postsPage.path;
  const title = heading ?? config.postsPage.title;
  const intro = description ?? 'Browse published posts by topic, author, and archive.';
  const search = firstParam(searchParams.search)?.trim() ?? '';
  const category = firstParam(searchParams.category)?.trim() ?? '';
  const tag = firstParam(searchParams.tag)?.trim() ?? '';
  const authorId = firstParam(searchParams.authorId)?.trim() ?? '';
  const year = firstParam(searchParams.year)?.trim() ?? '';
  const month = firstParam(searchParams.month)?.trim() ?? '';

  const posts = await getPublishedPosts({ search, category, tag, authorId, year, month });

  const activeFilterCount = [search, category, tag, authorId, year, month].filter(Boolean).length;

  return (
    <PublicSiteShell siteConfig={config}>
      <main className="mx-auto w-full max-w-7xl p-8">
        <section>
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold" style={{ color: config.theme.primaryColor }}>
                {title}
              </h1>
              <p className="max-w-3xl text-gray-600">{intro}</p>
            </div>

            <form action={blogPath} className="flex w-full gap-3 lg:max-w-md">
              <input
                name="search"
                defaultValue={search}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm"
                placeholder="Search posts"
              />
              <button
                className="rounded px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: config.theme.primaryColor }}
              >
                Search
              </button>
            </form>
          </div>

          {activeFilterCount > 0 && (
            <div
              className="mb-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              style={{
                borderColor: `${config.theme.primaryColor}33`,
                backgroundColor: `${config.theme.primaryColor}12`,
                color: config.theme.primaryColor,
              }}
            >
              <span>{posts.length} result{posts.length === 1 ? '' : 's'} with filters applied.</span>
              <Link href={blogPath} className="font-medium hover:underline">
                Clear filters
              </Link>
            </div>
          )}

          {posts.length === 0 ? (
            <p className="text-gray-500">No published posts found.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => {
                const preview = toPlainText(post.excerpt || post.content);
                const featuredImageSrc = getSafeImageSrc(post.featuredImageUrl);

                return (
                  <article key={post.id} className="flex h-full flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    {featuredImageSrc && (
                      <Link href={`/blog/${post.slug}`}>
                        <img src={featuredImageSrc} alt={post.title} className="h-56 w-full object-cover" />
                      </Link>
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="text-xl font-semibold">
                        <Link href={`/blog/${post.slug}`} className="hover:underline">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString()} •{' '}
                        <Link href={`/blog/authors/${post.author.id}`} className="hover:underline" style={{ color: config.theme.accentColor }}>
                          {post.author.name}
                        </Link>
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-gray-700">
                        {preview.slice(0, BLOG_EXCERPT_LENGTH)}
                        {preview.length > BLOG_EXCERPT_LENGTH ? '…' : ''}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        {post.categories.map((item) => (
                          <Link
                            key={item.id}
                            href={`/blog/categories/${item.slug}`}
                            className="rounded px-2 py-1 hover:opacity-90"
                            style={{
                              backgroundColor: `${config.theme.primaryColor}12`,
                              color: config.theme.primaryColor,
                            }}
                          >
                            {item.name}
                          </Link>
                        ))}
                        {post.tags.map((item) => (
                          <Link key={item.id} href={`/blog/tags/${item.slug}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">
                            #{item.name}
                          </Link>
                        ))}
                      </div>
                      <Link href={`/blog/${post.slug}`} className="mt-auto pt-5 text-sm font-medium hover:underline" style={{ color: config.theme.primaryColor }}>
                        Read post
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PublicSiteShell>
  );
}
