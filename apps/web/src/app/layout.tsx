import type { Metadata } from 'next';
import '../styles/globals.css';
import { getSiteUrl } from '../lib/seo';
import { getPublicSiteConfig, getSafeImageSrc } from '../lib/public-cms';

const defaultMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Psychic Link CMS',
  description: 'Platform for advisors and clients',
};

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  const favicon = getSafeImageSrc(siteConfig.identity.faviconUrl);

  return {
    metadataBase: new URL(getSiteUrl()),
    title: siteConfig.identity.title || defaultMetadata.title,
    description: siteConfig.identity.tagline || defaultMetadata.description,
    icons: favicon ? { icon: favicon, shortcut: favicon, apple: favicon } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
