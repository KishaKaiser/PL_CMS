import Link from 'next/link';
import { PublicSiteShell } from '../../../../../components/public-site-shell';
import { getPublishedPosts, toPlainText } from '../../../../../lib/public-cms';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ year: string; month: string }> };

function monthLabel(year: string, month: string) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default async function BlogArchiveMonthPage({ params }: Props) {
  const { year, month } = await params;
  const posts = await getPublishedPosts({ year, month });

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-4xl p-8">
        <nav className="mb-4 text-sm text-gray-500">
          <Link href="/blog" className="hover:underline">
            Blog
          </Link>{' '}
          / <Link href="/blog/archive" className="hover:underline">Archive</Link>
        </nav>
        <h1 className="text-3xl font-bold">{monthLabel(year, month)}</h1>
        <p className="mt-2 text-gray-600">{posts.length} published post{posts.length === 1 ? '' : 's'}.</p>

        <div className="mt-8 space-y-4">
          {posts.map((post) => (
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
