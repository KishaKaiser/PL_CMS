import { notFound } from 'next/navigation';
import { PublicSiteShell } from '../../components/public-site-shell';
import { getPublishedPage, toPlainText } from '../../lib/public-cms';

type Props = { params: Promise<{ slug: string }> };

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);

  if (!page) notFound();

  return (
    <PublicSiteShell>
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold">{page.title}</h1>
          <article className="whitespace-pre-wrap text-gray-800">{toPlainText(page.content)}</article>
        </div>
      </main>
    </PublicSiteShell>
  );
}
