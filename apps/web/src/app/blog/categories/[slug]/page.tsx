import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicSiteShell } from '../../../../components/public-site-shell';
import { getCategoryPosts, toPlainText } from '../../../../lib/public-cms';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export default async function CategoryPostsPage({ params }: Props) {
  const { slug } = await params;
  const data = await getCategoryPosts(slug);

  if (!data) notFound();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-4xl p-8">
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/blog" className="hover:underline">
            Blog
          </Link>{' '}
          / Category
        </nav>
        <h1 className="text-3xl font-bold">Category: {data.category.name}</h1>
        <p className="mt-2 text-gray-600">{data.posts.length} published post{data.posts.length === 1 ? '' : 's'}.</p>

        <div className="mt-8 space-y-4">
          {data.posts.map((post) => (
            <article key={post.id} className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(post.publishedAt).toLocaleDateString()} • {post.author.name}
              </p>
              <p className="mt-3 text-gray-700">{toPlainText(post.excerpt || post.content).slice(0, 180)}…</p>
            </article>
          ))}
        </div>
      </main>
    </PublicSiteShell>
  );
}
