import { notFound } from 'next/navigation';
import { BlogIndex } from '../../components/blog-index';
import { PublicSiteShell } from '../../components/public-site-shell';
import { RichContent } from '../../components/cms/rich-content';
import { getPublishedPage, getPublicSiteConfig, getSafeImageSrc } from '../../lib/public-cms';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SearchParams>;
};

export default async function CmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.postsPage.pageSlug && slug === siteConfig.postsPage.pageSlug) {
    return <BlogIndex searchParams={(await searchParams) ?? {}} siteConfig={siteConfig} />;
  }

  const page = await getPublishedPage(slug);

  if (!page) notFound();

  const featuredImageSrc = getSafeImageSrc(page.featuredImageUrl);

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto max-w-3xl p-8">
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {featuredImageSrc && (
            <img src={featuredImageSrc} alt={page.title} className="h-72 w-full object-cover" />
          )}
          <div className="p-8">
            <h1 className="mb-4 text-3xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
              {page.title}
            </h1>
            <RichContent html={page.content} className="prose max-w-none text-gray-800" />
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
