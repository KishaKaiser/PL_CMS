import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { RichContent } from '../../../components/cms/rich-content';
import { ReviewSection } from '../../../components/reviews/review-section';
import { getPublishedPost, getPublicSiteConfig, getRelatedPosts, resolvePostRedirect, toPlainText } from '../../../lib/public-cms';
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
  const post = await getPublishedPost(slug);

  if (!post) {
    const redirectTarget = await resolvePostRedirect(slug);
    if (redirectTarget) permanentRedirect(redirectTarget);
    notFound();
  }

  const relatedPosts = (await getRelatedPosts(slug)).filter((item) => item.id !== post.id).slice(0, 3);

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
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
                    <article key={related.id} className="rounded-lg border p-4">
                      <h3 className="font-medium">
                        <Link href={`/blog/${related.slug}`} className="hover:underline">
                          {related.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-gray-600">{toPlainText(related.excerpt || related.content).slice(0, 110)}…</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
