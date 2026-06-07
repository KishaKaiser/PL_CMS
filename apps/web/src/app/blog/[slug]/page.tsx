import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { getPublishedPost, toPlainText } from '../../../lib/public-cms';

type Props = { params: Promise<{ slug: string }> };

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) notFound();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            {' / '}
            <span>{post.title}</span>
          </nav>

          <h1 className="text-3xl font-bold">{post.title}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {new Date(post.publishedAt).toLocaleDateString()} • {post.author.name}
          </p>

          {post.excerpt && <p className="mt-6 text-lg text-gray-600">{toPlainText(post.excerpt)}</p>}

          <article className="mt-6 whitespace-pre-wrap text-gray-800">{toPlainText(post.content)}</article>
        </div>
      </main>
    </PublicSiteShell>
  );
}
