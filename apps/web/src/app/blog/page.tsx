import Link from 'next/link';
import { PublicSiteShell } from '../../components/public-site-shell';
import {
  getArchives,
  getAuthors,
  getCategories,
  getPublishedPosts,
  getTags,
  toPlainText,
} from '../../lib/public-cms';

const BLOG_EXCERPT_LENGTH = 180;
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default async function BlogPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const search = firstParam(params.search)?.trim() ?? '';
  const category = firstParam(params.category)?.trim() ?? '';
  const tag = firstParam(params.tag)?.trim() ?? '';
  const authorId = firstParam(params.authorId)?.trim() ?? '';
  const year = firstParam(params.year)?.trim() ?? '';
  const month = firstParam(params.month)?.trim() ?? '';

  const [posts, categories, tags, authors, archives] = await Promise.all([
    getPublishedPosts({ search, category, tag, authorId, year, month }),
    getCategories(),
    getTags(),
    getAuthors(),
    getArchives(),
  ]);

  const activeFilterCount = [search, category, tag, authorId, year, month].filter(Boolean).length;

  return (
    <PublicSiteShell>
      <main className="mx-auto grid max-w-6xl gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          <h1 className="mb-2 text-3xl font-bold">Blog</h1>
          <p className="mb-4 text-gray-600">Browse published posts by topic, author, and archive.</p>

          <form action="/blog" className="mb-6 flex gap-3">
            <input
              name="search"
              defaultValue={search}
              className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm"
              placeholder="Search posts"
            />
            <button className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Search</button>
          </form>

          {activeFilterCount > 0 && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              <span>{posts.length} result{posts.length === 1 ? '' : 's'} with filters applied.</span>
              <Link href="/blog" className="font-medium hover:underline">
                Clear filters
              </Link>
            </div>
          )}

          {posts.length === 0 ? (
            <p className="text-gray-500">No published posts found.</p>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => {
                const preview = toPlainText(post.excerpt || post.content);

                return (
                  <article key={post.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    {post.featuredImageUrl && (
                      <img src={post.featuredImageUrl} alt={post.title} className="h-56 w-full object-cover" />
                    )}
                    <div className="p-6">
                      <h2 className="text-xl font-semibold">
                        <Link href={`/blog/${post.slug}`} className="hover:underline">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {new Date(post.publishedAt).toLocaleDateString()} •{' '}
                        <Link href={`/blog/authors/${post.author.id}`} className="hover:text-indigo-700 hover:underline">
                          {post.author.name}
                        </Link>
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-gray-700">
                        {preview.slice(0, BLOG_EXCERPT_LENGTH)}
                        {preview.length > BLOG_EXCERPT_LENGTH ? '…' : ''}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        {post.categories.map((item) => (
                          <Link key={item.id} href={`/blog/categories/${item.slug}`} className="rounded bg-indigo-50 px-2 py-1 text-indigo-700 hover:bg-indigo-100">
                            {item.name}
                          </Link>
                        ))}
                        {post.tags.map((item) => (
                          <Link key={item.id} href={`/blog/tags/${item.slug}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">
                            #{item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Categories</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {categories.map((item) => (
                <li key={item.id}>
                  <Link href={`/blog/categories/${item.slug}`} className="hover:text-indigo-700 hover:underline">
                    {item.name} ({item.postCount})
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Tags</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {tags.map((item) => (
                <Link key={item.id} href={`/blog/tags/${item.slug}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">
                  #{item.name} ({item.postCount})
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Authors</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {authors.map((item) => (
                <li key={item.id}>
                  <Link href={`/blog/authors/${item.id}`} className="hover:text-indigo-700 hover:underline">
                    {item.name} ({item.postCount})
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Archives</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {archives.slice(0, 6).map((archive) => (
                <li key={archive.key}>
                  <Link href={`/blog/archive/${archive.year}/${String(archive.month).padStart(2, '0')}`} className="hover:text-indigo-700 hover:underline">
                    {monthLabel(archive.year, archive.month)} ({archive.count})
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/blog/archive" className="mt-3 inline-block text-xs font-medium text-indigo-700 hover:underline">
              View all archives
            </Link>
          </section>
        </aside>
      </main>
    </PublicSiteShell>
  );
}
