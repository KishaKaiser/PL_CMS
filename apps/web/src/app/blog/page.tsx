import { BlogIndex } from '../../components/blog-index';
import { getPublicSiteConfig } from '../../lib/public-cms';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

export default async function BlogPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const siteConfig = await getPublicSiteConfig();

  return <BlogIndex searchParams={params} siteConfig={siteConfig} />;
}
