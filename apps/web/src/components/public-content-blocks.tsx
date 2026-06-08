import Link from 'next/link';
import {
  getSafeImageSrc,
  toPlainText,
  type PublicPage,
  type PublicPost,
  type PublicSiteConfig,
} from '../lib/public-cms';

const HOMEPAGE_EXCERPT_LENGTH = 120;

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function FeaturedPagesBlock({
  title,
  pages,
}: {
  title: string;
  pages: PublicPage[];
}) {
  return (
    <section>
      <SectionHeading title={title} />
      {pages.length === 0 ? (
        <p className="text-gray-500">No published pages yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {pages.map((page) => {
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
  );
}

export function LatestPostsBlock({
  title,
  posts,
  siteConfig,
}: {
  title: string;
  posts: PublicPost[];
  siteConfig: PublicSiteConfig;
}) {
  return (
    <section>
      <SectionHeading
        title={title}
        action={(
          <Link href={siteConfig.postsPage.path} className="text-sm hover:underline" style={{ color: siteConfig.theme.primaryColor }}>
            View all posts
          </Link>
        )}
      />

      {posts.length === 0 ? (
        <p className="text-gray-500">No published posts yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {posts.map((post) => {
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
  );
}

export function CalloutBlock({
  title,
  body,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  siteConfig,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  siteConfig: PublicSiteConfig;
}) {
  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold" style={{ color: siteConfig.theme.primaryColor }}>
        {title}
      </h2>
      <p className="mt-2 text-gray-700">{body}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {primaryLabel && primaryHref && (
          <Link
            href={primaryHref}
            className="rounded px-4 py-2 text-white hover:opacity-90"
            style={{ backgroundColor: siteConfig.theme.primaryColor }}
          >
            {primaryLabel}
          </Link>
        )}
        {secondaryLabel && secondaryHref && (
          <Link
            href={secondaryHref}
            className="rounded border px-4 py-2 hover:bg-gray-100"
            style={{ borderColor: `${siteConfig.theme.primaryColor}55`, color: siteConfig.theme.primaryColor }}
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
