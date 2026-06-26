import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { BlogIndex } from '../../components/blog-index';
import { getPublishedPage, getPublicSiteConfig } from '../../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../../lib/seo';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  const page = siteConfig.postsPage.pageSlug ? await getPublishedPage(siteConfig.postsPage.pageSlug) : null;

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

export default async function BlogPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.postsPage.path !== '/blog') {
    permanentRedirect(siteConfig.postsPage.path);
  }

  const page = siteConfig.postsPage.pageSlug ? await getPublishedPage(siteConfig.postsPage.pageSlug) : null;

  return (
    <BlogIndex
      searchParams={params}
      siteConfig={siteConfig}
      heading={page?.title ?? siteConfig.postsPage.title}
      description={page?.metaDescription ?? undefined}
      contentHtml={page?.content}
      builderLayout={page?.builderLayout}
    />
  );
}
