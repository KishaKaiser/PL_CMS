import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogIndex } from '../components/blog-index';
import {
  CalloutBlock,
  FeaturedPagesBlock,
  LatestPostsBlock,
} from '../components/public-content-blocks';
import { PublicSiteShell } from '../components/public-site-shell';
import { BuilderContent } from '../components/cms/builder-content';
import { RichContent } from '../components/cms/rich-content';
import {
  getPublishedPage,
  getPublishedPages,
  getPublishedPosts,
  getPublicSiteConfig,
  getSafeImageSrc,
} from '../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../lib/seo';

const MAX_FEATURED_PAGES = 3;
const MAX_FEATURED_POSTS = 3;
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams?: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.homepage.mode === 'latest_posts') {
    return buildSeoMetadata({
      title: getSeoTitle(siteConfig.postsPage.title),
      description: getSeoDescription(siteConfig.theme.heroBody, siteConfig.identity.tagline),
      path: '/',
      siteName: siteConfig.identity.title,
    });
  }

  const homePage = await getPublishedPage(siteConfig.homepage.selectedPage?.slug || 'home');

  return buildSeoMetadata({
    title: homePage ? getSeoTitle(homePage.title, homePage.metaTitle) : siteConfig.identity.title,
    description: homePage
      ? getSeoDescription(homePage.metaDescription, homePage.content, siteConfig.identity.tagline)
      : getSeoDescription(siteConfig.theme.heroBody, siteConfig.identity.tagline),
    path: '/',
    imageUrl: homePage?.featuredImageUrl ?? siteConfig.identity.logoUrl,
    siteName: siteConfig.identity.title,
  });
}

export default async function HomePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const siteConfig = await getPublicSiteConfig();

  if (siteConfig.homepage.mode === 'latest_posts') {
    return (
      <BlogIndex
        searchParams={params}
        basePath="/"
        heading={siteConfig.theme.heroTitle || siteConfig.postsPage.title}
        description={siteConfig.theme.heroBody}
        siteConfig={siteConfig}
      />
    );
  }

  const managedHomepageSlug = siteConfig.homepage.selectedPage?.slug;
  const [homePage, posts, pages] = await Promise.all([
    getPublishedPage(managedHomepageSlug || 'home'),
    getPublishedPosts(),
    getPublishedPages('home'),
  ]);
  const featuredPages = pages
    .filter((page) => page.slug !== siteConfig.postsPage.pageSlug)
    .slice(0, MAX_FEATURED_PAGES);
  const featuredPosts = posts.slice(0, MAX_FEATURED_POSTS);
  const homePageImageSrc = getSafeImageSrc(homePage?.featuredImageUrl);
  const builderLayout = homePage?.builderLayout;
  const showHomePageTitle = builderLayout?.settings?.showTitle !== false;
  const showSiteHeader = builderLayout?.settings?.showHeader !== false;
  const showSiteFooter = builderLayout?.settings?.showFooter !== false;

  if (homePage && builderLayout) {
    return (
      <PublicSiteShell siteConfig={siteConfig} showHeader={showSiteHeader} showFooter={showSiteFooter}>
        <main>
          <BuilderContent layout={builderLayout} breadcrumbLabel={homePage.title} />
        </main>
      </PublicSiteShell>
    );
  }

  if (managedHomepageSlug && homePage) {
    return (
      <PublicSiteShell siteConfig={siteConfig}>
        <main className="mx-auto max-w-7xl p-8">
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            {homePageImageSrc && (
              <img src={homePageImageSrc} alt={homePage.title} className="h-72 w-full object-cover" />
            )}
            <div className="p-8">
              {showHomePageTitle && (
                <h1 className="mb-4 text-3xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
                  {homePage.title}
                </h1>
              )}
              <RichContent html={homePage.content} className="prose max-w-none text-gray-800" />
            </div>
          </div>
        </main>
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-8">
        <header className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {homePageImageSrc && (
            <img src={homePageImageSrc} alt={homePage?.title ?? siteConfig.identity.title} className="h-64 w-full object-cover" />
          )}
          <div className="p-6">
            {showHomePageTitle && (
              <h1 className="text-4xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
                {siteConfig.theme.heroTitle || homePage?.title || siteConfig.identity.title}
              </h1>
            )}
            <div className="mt-4 text-gray-700">
              {homePage?.content ? (
                <RichContent html={homePage.content} className="prose max-w-none text-gray-700" />
              ) : (
                <p>{siteConfig.theme.heroBody}</p>
              )}
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-3">
          <Link
            href={siteConfig.theme.heroPrimaryHref || siteConfig.postsPage.path}
            className="rounded px-4 py-2 text-white hover:opacity-90"
            style={{ backgroundColor: siteConfig.theme.primaryColor }}
          >
            {siteConfig.theme.heroPrimaryLabel || siteConfig.postsPage.title}
          </Link>
          <Link
            href={siteConfig.theme.heroSecondaryHref || '/admin'}
            className="rounded border px-4 py-2 hover:bg-gray-100"
            style={{ borderColor: `${siteConfig.theme.primaryColor}55`, color: siteConfig.theme.primaryColor }}
          >
            {siteConfig.theme.heroSecondaryLabel || 'Admin'}
          </Link>
        </nav>

        {siteConfig.homepageBlocks
          .filter((block) => block.enabled)
          .map((block) => {
            if (block.type === 'featured_pages') {
              return <FeaturedPagesBlock key={block.id} title={block.title} pages={featuredPages} />;
            }

            if (block.type === 'latest_posts') {
              return (
                <LatestPostsBlock
                  key={block.id}
                  title={block.title}
                  posts={featuredPosts}
                  siteConfig={siteConfig}
                />
              );
            }

            return (
              <CalloutBlock
                key={block.id}
                title={block.title}
                body={block.body}
                primaryLabel={block.primaryLabel}
                primaryHref={block.primaryHref}
                secondaryLabel={block.secondaryLabel}
                secondaryHref={block.secondaryHref}
                siteConfig={siteConfig}
              />
            );
          })}
      </main>
    </PublicSiteShell>
  );
}
