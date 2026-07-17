import type { Metadata } from 'next';
import { ZODIAC_SIGNS, ZODIAC_SYMBOLS, type ZodiacSign } from '@pl-cms/shared';
import { PublicSiteShell } from '../../components/public-site-shell';
import { getHoroscopes, getPublicSiteConfig } from '../../lib/public-cms';
import { buildSeoMetadata } from '../../lib/seo';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  return buildSeoMetadata({
    title: `Monthly Horoscopes | ${siteConfig.identity.title}`,
    description: 'Monthly horoscopes for all zodiac signs, covering career, money, and love.',
    path: '/horoscopes',
    siteName: siteConfig.identity.title,
  });
}

export default async function HoroscopesPage() {
  const siteConfig = await getPublicSiteConfig();
  const now = new Date();
  const horoscopes = await getHoroscopes(now.getFullYear(), now.getMonth() + 1);
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: siteConfig.theme.primaryColor }}>
            {monthLabel}
          </p>
          <h1 className="mt-2 text-4xl font-bold text-gray-950">Monthly Horoscopes</h1>
          <p className="mt-3 text-gray-600">Career, money, and love guidance for every sign this month.</p>
        </header>

        {horoscopes.every((entry) => !entry) ? (
          <p className="text-center text-gray-500">This month&apos;s horoscopes aren&apos;t ready yet — check back soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ZODIAC_SIGNS.map((sign, index) => {
              const entry = horoscopes[index];
              return <SignCard key={sign} sign={sign} entry={entry} accentColor={siteConfig.theme.primaryColor} />;
            })}
          </div>
        )}
      </main>
    </PublicSiteShell>
  );
}

function SignCard({
  sign,
  entry,
  accentColor,
}: {
  sign: ZodiacSign;
  entry: { overview: string; career: string; money: string; love: string } | null;
  accentColor: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl" style={{ color: accentColor }}>{ZODIAC_SYMBOLS[sign]}</span>
        <h2 className="text-xl font-semibold text-gray-950">{sign}</h2>
      </div>
      {entry ? (
        <div className="space-y-3 text-sm text-gray-700">
          <p>{entry.overview}</p>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Career</h3>
            <p className="mt-1">{entry.career}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Money</h3>
            <p className="mt-1">{entry.money}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Love & Relationships</h3>
            <p className="mt-1">{entry.love}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Not available yet this month.</p>
      )}
    </div>
  );
}
