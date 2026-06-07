import { notFound } from 'next/navigation';
import { PublicSiteShell } from '../../components/public-site-shell';
import { RichContent } from '../../components/cms/rich-content';
import { getPublishedPage } from '../../lib/public-cms';

type Props = { params: Promise<{ slug: string }> };

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  if (!page) notFound();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {page.featuredImageUrl && (
            <img src={page.featuredImageUrl} alt={page.title} className="h-72 w-full object-cover" />
          )}
          <div className="p-8">
            <h1 className="mb-4 text-3xl font-bold">{page.title}</h1>
            <RichContent html={page.content} className="prose max-w-none text-gray-800" />
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
