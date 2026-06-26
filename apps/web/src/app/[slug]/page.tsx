import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { BlogIndex } from '../../components/blog-index';
import { PublicSiteShell } from '../../components/public-site-shell';
import { BuilderContent } from '../../components/cms/builder-content';
import { RichContent } from '../../components/cms/rich-content';
import { getPublishedPage, getPublicSiteConfig, getSafeImageSrc, resolvePageRedirect } from '../../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../../lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SearchParams>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { slug } = await params;
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.postsPage.pageSlug && slug === siteConfig.postsPage.pageSlug) {
    const page = await getPublishedPage(slug);
    return buildSeoMetadata({
      title: page ? getSeoTitle(page.title, page.metaTitle) : getSeoTitle(siteConfig.postsPage.title),
      description: page
        ? getSeoDescription(page.metaDescription, page.content, siteConfig.identity.tagline)
        : getSeoDescription(siteConfig.theme.heroBody, siteConfig.identity.tagline),
      path: siteConfig.postsPage.path,
      imageUrl: page?.featuredImageUrl ?? siteConfig.identity.logoUrl,
      siteName: siteConfig.identity.title,
    });
  }

  const page = await getPublishedPage(slug);
  if (!page) return {};

  return buildSeoMetadata({
    title: getSeoTitle(page.title, page.metaTitle),
    description: getSeoDescription(page.metaDescription, page.content, siteConfig.identity.tagline),
    path: `/${page.slug}`,
    imageUrl: page.featuredImageUrl ?? siteConfig.identity.logoUrl,
    siteName: siteConfig.identity.title,
  });
}

export default async function CmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.postsPage.pageSlug && slug === siteConfig.postsPage.pageSlug) {
    const page = await getPublishedPage(slug);
    return (
      <BlogIndex
        searchParams={(await searchParams) ?? {}}
        siteConfig={siteConfig}
        heading={page?.title ?? siteConfig.postsPage.title}
        description={page?.metaDescription ?? undefined}
        contentHtml={page?.content}
        showTitle={page?.builderLayout?.settings?.showTitle !== false}
        showBreadcrumbs={page?.builderLayout?.settings?.breadcrumbs !== false}
      />
    );
  }

  const page = await getPublishedPage(slug);

  if (!page) {
    const redirectTarget = await resolvePageRedirect(slug);
    if (redirectTarget) permanentRedirect(redirectTarget);
    notFound();
  }

  const featuredImageSrc = getSafeImageSrc(page.featuredImageUrl);
  const builderLayout = page.builderLayout;
  const showPageTitle = builderLayout?.settings?.showTitle !== false;
  const showSiteHeader = builderLayout?.settings?.showHeader !== false;
  const showSiteFooter = builderLayout?.settings?.showFooter !== false;

  return (
    <PublicSiteShell siteConfig={siteConfig} showHeader={showSiteHeader} showFooter={showSiteFooter}>
      {builderLayout ? (
        <main>
          <BuilderContent layout={builderLayout} breadcrumbLabel={page.title} />
        </main>
      ) : (
        <main className="mx-auto max-w-3xl p-8">
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            {featuredImageSrc && (
              <img src={featuredImageSrc} alt={page.title} className="h-72 w-full object-cover" />
            )}
            <div className="p-8">
              {showPageTitle && (
                <h1 className="mb-4 text-3xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
                  {page.title}
                </h1>
              )}
              <RichContent html={page.content} className="prose max-w-none text-gray-800" />
            </div>
          </div>
        </main>
      )}
    </PublicSiteShell>
  );
}
