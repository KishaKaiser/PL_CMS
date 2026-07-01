import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { RichContent } from '../../../components/cms/rich-content';
import { NewsletterSidebarWidget } from '../../../components/cms/newsletter-sidebar-widget';
import { ReviewSection } from '../../../components/reviews/review-section';
import {
  getArchives,
  getAuthors,
  getCategories,
  getPublishedPost,
  getPublicSiteConfig,
  getRelatedPosts,
  getSafeImageSrc,
  getTags,
  resolvePostRedirect,
  toPlainText,
  type PublicSiteConfig,
} from '../../../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../../../lib/seo';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, siteConfig] = await Promise.all([getPublishedPost(slug), getPublicSiteConfig()]);
  if (!post) return {};

  return buildSeoMetadata({
    title: getSeoTitle(post.title, post.metaTitle),
    description: getSeoDescription(post.metaDescription, post.excerpt, post.content, siteConfig.identity.tagline),
    path: `/blog/${post.slug}`,
    imageUrl: post.featuredImageUrl,
    siteName: siteConfig.identity.title,
    type: 'article',
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, siteConfig] = await Promise.all([getPublishedPost(slug), getPublicSiteConfig()]);

  if (!post) {
    const redirectTarget = await resolvePostRedirect(slug);
    if (redirectTarget) permanentRedirect(redirectTarget);
    notFound();
  }

  const relatedPosts = (await getRelatedPosts(slug)).filter((item) => item.id !== post.id).slice(0, 3);

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto grid w-full max-w-7xl gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {post.featuredImageUrl && (
            <img src={post.featuredImageUrl} alt={post.title} className="h-72 w-full object-cover" />
          )}
          <div className="p-8">
            <nav className="mb-6 text-sm text-gray-500">
              <Link href="/blog" className="hover:underline">
                Blog
              </Link>
              {' / '}
              <span>{post.title}</span>
            </nav>

            <h1 className="text-3xl font-bold">{post.title}</h1>
            <p className="mt-2 text-sm text-gray-500">
              {new Date(post.publishedAt).toLocaleDateString()} •{' '}
              <Link href={`/blog/authors/${post.author.id}`} className="hover:text-purple-700 hover:underline">
                {post.author.name}
              </Link>
            </p>

            {(post.categories.length > 0 || post.tags.length > 0) && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {post.categories.map((item) => (
                  <Link key={item.id} href={`/blog/categories/${item.slug}`} className="rounded bg-purple-50 px-2 py-1 text-purple-700 hover:bg-purple-100">
                    {item.name}
                  </Link>
                ))}
                {post.tags.map((item) => (
                  <Link key={item.id} href={`/blog/tags/${item.slug}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">
                    #{item.name}
                  </Link>
                ))}
              </div>
            )}

            {post.excerpt && <p className="mt-6 text-lg text-gray-600">{toPlainText(post.excerpt)}</p>}

            <RichContent html={post.content} className="prose mt-6 max-w-none text-gray-800" />

            <ReviewSection title="Comments and Ratings" endpoint={`/api/proxy/public/posts/${post.slug}/comments`} />

            {relatedPosts.length > 0 && (
              <section className="mt-10 border-t pt-8">
                <h2 className="text-xl font-semibold">Related posts</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {relatedPosts.map((related) => (
                    <article key={related.id} className="overflow-hidden rounded-lg border bg-white">
                      {getSafeImageSrc(related.featuredImageUrl) && (
                        <Link href={`/blog/${related.slug}`}>
                          <img src={getSafeImageSrc(related.featuredImageUrl) ?? ''} alt={related.title} className="h-32 w-full object-cover" />
                        </Link>
                      )}
                      <div className="p-4">
                        <h3 className="font-medium">
                          <Link href={`/blog/${related.slug}`} className="hover:underline">
                            {related.title}
                          </Link>
                        </h3>
                        <p className="mt-2 text-sm text-gray-600">{toPlainText(related.excerpt || related.content).slice(0, 110)}…</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>
        <BlogPostSidebar siteConfig={siteConfig} />
      </main>
    </PublicSiteShell>
  );
}

async function BlogPostSidebar({ siteConfig }: { siteConfig: PublicSiteConfig }) {
  const sidebarWidgets = siteConfig.sidebars.blog.filter((widget) => widget.enabled);
  const [categories, tags, authors, archives] = await Promise.all([
    getCategories(),
    getTags(),
    getAuthors(),
    getArchives(),
  ]);

  return (
    <aside className="space-y-6">
      {sidebarWidgets.map((widget) => {
        if (widget.type === 'search') return (
          <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <form action={siteConfig.postsPage.path} className="mt-3 flex gap-2">
              <input name="search" className="w-full rounded border border-gray-200 px-3 py-2 text-sm" placeholder="Search posts" />
              <button className="rounded px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: siteConfig.theme.primaryColor }}>Go</button>
            </form>
          </section>
        );

        if (widget.type === 'categories') return (
          <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {categories.map((item) => (
                <li key={item.id}>
                  <Link href={`/blog/categories/${item.slug}`} className="hover:underline" style={{ color: siteConfig.theme.accentColor }}>
                    {item.name} ({item.postCount})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );

        if (widget.type === 'tags') return (
          <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {tags.map((item) => (
                <Link key={item.id} href={`/blog/tags/${item.slug}`} className="rounded bg-gray-100 px-2 py-1 text-gray-700 hover:bg-gray-200">
                  #{item.name} ({item.postCount})
                </Link>
              ))}
            </div>
          </section>
        );

        if (widget.type === 'authors') return (
          <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {authors.map((item) => (
                <li key={item.id}>
                  <Link href={`/blog/authors/${item.id}`} className="hover:underline" style={{ color: siteConfig.theme.accentColor }}>
                    {item.name} ({item.postCount})
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );

        if (widget.type === 'archives') return (
          <section key={widget.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {archives.slice(0, 6).map((archive) => (
                <li key={archive.key}>
                  <Link href={`/blog/archive/${archive.year}/${String(archive.month).padStart(2, '0')}`} className="hover:underline" style={{ color: siteConfig.theme.accentColor }}>
                    {monthLabel(archive.year, archive.month)} ({archive.count})
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/blog/archive" className="mt-3 inline-block text-xs font-medium hover:underline" style={{ color: siteConfig.theme.primaryColor }}>
              View all archives
            </Link>
          </section>
        );

        if (widget.type === 'newsletter') return <NewsletterSidebarWidget key={widget.id} widget={widget} />;

        return (
          <section key={widget.id} className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-500 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{widget.title}</h2>
            <p className="mt-2">This widget type is ready for future sidebar content.</p>
          </section>
        );
      })}
    </aside>
  );
}

function monthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
