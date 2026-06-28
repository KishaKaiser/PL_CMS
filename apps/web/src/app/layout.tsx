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
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Lora:wght@400;500;600;700&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
