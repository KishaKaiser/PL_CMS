import Link from 'next/link';
import { PublicSiteShell } from '../../components/public-site-shell';
import { getPublishedPosts, toPlainText } from '../../lib/public-cms';

const BLOG_EXCERPT_LENGTH = 180;
export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await getPublishedPosts();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="mb-2 text-3xl font-bold">Blog</h1>
        <p className="mb-8 text-gray-600">Latest published posts from the CMS.</p>

        {posts.length === 0 ? (
          <p className="text-gray-500">No published posts yet.</p>
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
                      {new Date(post.publishedAt).toLocaleDateString()} • {post.author.name}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-gray-700">
                      {preview.slice(0, BLOG_EXCERPT_LENGTH)}
                      {preview.length > BLOG_EXCERPT_LENGTH ? '…' : ''}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </PublicSiteShell>
  );
}
