import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { BlogIndex } from '../../components/blog-index';
import { getPublicSiteConfig } from '../../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../../lib/seo';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();

  return buildSeoMetadata({
    title: getSeoTitle(siteConfig.postsPage.title),
    description: getSeoDescription(siteConfig.theme.heroBody, siteConfig.identity.tagline),
    path: siteConfig.postsPage.path,
    siteName: siteConfig.identity.title,
  });
}

export default async function BlogPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.postsPage.path !== '/blog') {
    permanentRedirect(siteConfig.postsPage.path);
  }

  return <BlogIndex searchParams={params} siteConfig={siteConfig} />;
}
