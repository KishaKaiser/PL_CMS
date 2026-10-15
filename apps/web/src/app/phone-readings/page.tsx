import type { Metadata } from 'next';
import { AdvisorGrid } from '../../components/phone/advisor-grid';
import { PublicSiteShell } from '../../components/public-site-shell';
import { getPublicSiteConfig } from '../../lib/public-cms';
import { buildSeoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  return buildSeoMetadata({
    title: `Phone Readings | ${siteConfig.identity.title}`,
    description: 'Talk to a psychic advisor by phone, right now. Pay per minute from your wallet.',
    path: '/phone-readings',
    siteName: siteConfig.identity.title,
  });
}

export default async function PhoneReadingsPage() {
  const siteConfig = await getPublicSiteConfig();

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: siteConfig.theme.primaryColor }}>
            Talk to an Advisor
          </p>
          <h1 className="mt-2 text-4xl font-bold text-gray-950">Phone Readings</h1>
          <p className="mt-3 text-gray-600">
            Press Call Now to talk to an available advisor right away, or schedule a call for later with any advisor. We ring your
            phone, connect you, and you only pay for the minutes you talk.
          </p>
        </header>

        <AdvisorGrid primaryColor={siteConfig.theme.primaryColor} />
      </main>
    </PublicSiteShell>
  );
}
