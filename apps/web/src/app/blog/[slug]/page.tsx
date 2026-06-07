import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { RichContent } from '../../../components/cms/rich-content';
import { getPublishedPost, toPlainText } from '../../../lib/public-cms';

type Props = { params: Promise<{ slug: string }> };

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) notFound();

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
              {new Date(post.publishedAt).toLocaleDateString()} • {post.author.name}
            </p>

            {post.excerpt && <p className="mt-6 text-lg text-gray-600">{toPlainText(post.excerpt)}</p>}

            <RichContent html={post.content} className="prose mt-6 max-w-none text-gray-800" />
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
