import type { Metadata } from 'next';
import { AdvisorGrid } from '../../components/phone/advisor-grid';
import { ScheduleSection } from '../../components/phone/schedule-section';
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
            Live Now
          </p>
          <h1 className="mt-2 text-4xl font-bold text-gray-950">Phone Readings</h1>
          <p className="mt-3 text-gray-600">
            Choose an advisor who is available and press Call Now. We ring your phone, connect you, and you only pay for the
            minutes you talk.
          </p>
        </header>

        <AdvisorGrid primaryColor={siteConfig.theme.primaryColor} />

        <section className="mt-20 border-t pt-14">
          <header className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-gray-950">Schedule a Call for Later</h2>
            <p className="mt-3 text-gray-600">
              Pick a day and time. The advisor confirms, and we ring your phone at that time. Your wallet is checked again when the
              call is placed.
            </p>
          </header>

          <ScheduleSection primaryColor={siteConfig.theme.primaryColor} />
        </section>
      </main>
    </PublicSiteShell>
  );
}
