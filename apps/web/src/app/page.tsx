import Link from 'next/link';
import { PublicSiteShell } from '../components/public-site-shell';
import { RichContent } from '../components/cms/rich-content';
import { getPublishedPage, getPublishedPages, getPublishedPosts, toPlainText } from '../lib/public-cms';

const HOMEPAGE_EXCERPT_LENGTH = 120;
const MAX_FEATURED_PAGES = 3;
const MAX_FEATURED_POSTS = 3;
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [homePage, posts, pages] = await Promise.all([
    getPublishedPage('home'),
    getPublishedPosts(),
    getPublishedPages('home'),
  ]);
  const featuredPages = pages.slice(0, MAX_FEATURED_PAGES);
  const featuredPosts = posts.slice(0, MAX_FEATURED_POSTS);

  return (
    <PublicSiteShell pages={pages}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
        <header className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {homePage?.featuredImageUrl && (
            <img src={homePage.featuredImageUrl} alt={homePage.title} className="h-64 w-full object-cover" />
          )}
          <div className="p-6">
            <h1 className="text-4xl font-bold text-indigo-700">{homePage?.title ?? 'Psychic Link CMS'}</h1>
            <div className="mt-4 text-gray-700">
              <RichContent
                html={homePage?.content ?? '<p>Welcome to the public site. Read our latest posts or browse CMS pages.</p>'}
                className="prose max-w-none text-gray-700"
              />
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          <Link href="/blog" className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Visit Blog
          </Link>
          <Link href="/login" className="rounded border px-4 py-2 hover:bg-gray-100">
            Login
          </Link>
          <Link href="/admin" className="rounded border px-4 py-2 hover:bg-gray-100">
            Admin
          </Link>
        </nav>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Browse Pages</h2>
          </div>

          {featuredPages.length === 0 ? (
            <p className="text-gray-500">No published pages yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {featuredPages.map((page) => {
                const preview = toPlainText(page.content);

                return (
                  <article key={page.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    {page.featuredImageUrl && (
                      <img src={page.featuredImageUrl} alt={page.title} className="h-40 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold">
                        <Link href={`/${page.slug}`} className="hover:underline">
                          {page.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-gray-700">
                        {preview.slice(0, HOMEPAGE_EXCERPT_LENGTH)}
                        {preview.length > HOMEPAGE_EXCERPT_LENGTH ? '…' : ''}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Latest Posts</h2>
            <Link href="/blog" className="text-sm text-indigo-600 hover:underline">
              View all posts
            </Link>
          </div>

          {featuredPosts.length === 0 ? (
            <p className="text-gray-500">No published posts yet.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {featuredPosts.map((post) => {
                const preview = toPlainText(post.excerpt || post.content);

                return (
                  <article key={post.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                    {post.featuredImageUrl && (
                      <img src={post.featuredImageUrl} alt={post.title} className="h-40 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <h3 className="text-lg font-semibold">
                        <Link href={`/blog/${post.slug}`} className="hover:underline">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-gray-500">{new Date(post.publishedAt).toLocaleDateString()}</p>
                      <p className="mt-2 text-sm text-gray-700">
                        {preview.slice(0, HOMEPAGE_EXCERPT_LENGTH)}
                        {preview.length > HOMEPAGE_EXCERPT_LENGTH ? '…' : ''}
                      </p>
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
