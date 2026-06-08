import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogIndex } from '../components/blog-index';
import { PublicSiteShell } from '../components/public-site-shell';
import { RichContent } from '../components/cms/rich-content';
import {
  getPublishedPage,
  getPublishedPages,
  getPublishedPosts,
  getPublicSiteConfig,
  getSafeImageSrc,
  toPlainText,
} from '../lib/public-cms';
import { buildSeoMetadata, getSeoDescription, getSeoTitle } from '../lib/seo';

const HOMEPAGE_EXCERPT_LENGTH = 120;
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

  if (managedHomepageSlug && homePage) {
    return (
      <PublicSiteShell siteConfig={siteConfig}>
        <main className="mx-auto max-w-3xl p-8">
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            {homePageImageSrc && (
              <img src={homePageImageSrc} alt={homePage.title} className="h-72 w-full object-cover" />
            )}
            <div className="p-8">
              <h1 className="mb-4 text-3xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
                {homePage.title}
              </h1>
              <RichContent html={homePage.content} className="prose max-w-none text-gray-800" />
            </div>
          </div>
        </main>
      </PublicSiteShell>
    );
  }

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">
        <header className="overflow-hidden rounded-lg border bg-white shadow-sm">
          {homePageImageSrc && (
            <img src={homePageImageSrc} alt={homePage?.title ?? siteConfig.identity.title} className="h-64 w-full object-cover" />
          )}
          <div className="p-6">
            <h1 className="text-4xl font-bold" style={{ color: siteConfig.theme.primaryColor }}>
              {siteConfig.theme.heroTitle || homePage?.title || siteConfig.identity.title}
            </h1>
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

        {siteConfig.theme.homepageSections.pages.enabled && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{siteConfig.theme.homepageSections.pages.title}</h2>
            </div>

            {featuredPages.length === 0 ? (
              <p className="text-gray-500">No published pages yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {featuredPages.map((page) => {
                  const preview = toPlainText(page.content);
                  const featuredImageSrc = getSafeImageSrc(page.featuredImageUrl);

                  return (
                    <article key={page.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                      {featuredImageSrc && (
                        <img src={featuredImageSrc} alt={page.title} className="h-40 w-full object-cover" />
                      )}
                      <div className="p-4">
                        <h3 className="text-lg font-semibold">
                          <Link href={`/${page.slug}`} className="hover:underline">
                            {page.title}
                          </Link>
                        </h3>
                        <p className="mt-2 text-sm text-gray-700">
                          {preview.slice(0, HOMEPAGE_EXCERPT_LENGTH)}
                          {preview.length > HOMEPAGE_EXCERPT_LENGTH ? '…' : ''}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {siteConfig.theme.homepageSections.posts.enabled && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">{siteConfig.theme.homepageSections.posts.title}</h2>
              <Link href={siteConfig.postsPage.path} className="text-sm hover:underline" style={{ color: siteConfig.theme.primaryColor }}>
                View all posts
              </Link>
            </div>

            {featuredPosts.length === 0 ? (
              <p className="text-gray-500">No published posts yet.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {featuredPosts.map((post) => {
                  const preview = toPlainText(post.excerpt || post.content);
                  const featuredImageSrc = getSafeImageSrc(post.featuredImageUrl);

                  return (
                    <article key={post.id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                      {featuredImageSrc && (
                        <img src={featuredImageSrc} alt={post.title} className="h-40 w-full object-cover" />
                      )}
                      <div className="p-4">
                        <h3 className="text-lg font-semibold">
                          <Link href={`/blog/${post.slug}`} className="hover:underline">
                            {post.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">{new Date(post.publishedAt).toLocaleDateString()}</p>
                        <p className="mt-2 text-sm text-gray-700">
                          {preview.slice(0, HOMEPAGE_EXCERPT_LENGTH)}
                          {preview.length > HOMEPAGE_EXCERPT_LENGTH ? '…' : ''}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </PublicSiteShell>
  );
}
