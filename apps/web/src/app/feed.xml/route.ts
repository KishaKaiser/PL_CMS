import { getPublishedPosts, getPublicSiteConfig, toPlainText } from '../../lib/public-cms';
import { getSeoDescription, getSiteUrl, toAbsoluteUrl } from '../../lib/seo';

const FEED_ITEM_LIMIT = 20;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const [siteConfig, posts] = await Promise.all([getPublicSiteConfig(), getPublishedPosts()]);
  const feedPosts = posts.slice(0, FEED_ITEM_LIMIT);
  const siteUrl = getSiteUrl();
  const channelLink = toAbsoluteUrl(siteConfig.postsPage.path) ?? `${siteUrl}/blog`;
  const latestPublishedAt = feedPosts[0]?.publishedAt ?? new Date().toISOString();

  const items = feedPosts
    .map((post) => {
      const link = toAbsoluteUrl(`/blog/${post.slug}`) ?? `${siteUrl}/blog/${post.slug}`;
      const description = getSeoDescription(post.metaDescription, post.excerpt, post.content) ?? '';

      return `
        <item>
          <title>${escapeXml(post.metaTitle?.trim() || post.title)}</title>
          <link>${escapeXml(link)}</link>
          <guid>${escapeXml(link)}</guid>
          <description>${escapeXml(description)}</description>
          <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
          <author>${escapeXml(post.author.name)}</author>
        </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(siteConfig.identity.title)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(getSeoDescription(siteConfig.identity.tagline, siteConfig.theme.heroBody) ?? toPlainText(siteConfig.identity.title))}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(latestPublishedAt).toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 's-maxage=300, stale-while-revalidate=3600',
    },
  });
}
