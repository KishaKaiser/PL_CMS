import type { Metadata } from 'next';
import '../styles/globals.css';
import { getSiteUrl } from '../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: 'Psychic Link CMS',
  description: 'Platform for advisors and clients',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
