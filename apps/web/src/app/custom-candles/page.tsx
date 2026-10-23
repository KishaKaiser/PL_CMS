import type { Metadata } from 'next';
import { CandleBuilder } from '../../components/candles/candle-builder';
import { PublicSiteShell } from '../../components/public-site-shell';
import { getCandleConfig } from '../../lib/candles';
import { getPublicSiteConfig } from '../../lib/public-cms';
import { buildSeoMetadata } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const siteConfig = await getPublicSiteConfig();
  return buildSeoMetadata({
    title: 'Custom Candles',
    description: 'Design your own candle: choose the candle, the color, the height and herbs, and watch it change as you choose.',
    path: '/custom-candles',
    siteName: siteConfig.identity.title,
  });
}

/** Where customers design their own candle. */
export default async function CustomCandlesPage() {
  const config = await getCandleConfig();
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-950 md:text-4xl">Design Your Own Candle</h1>
        <p className="mt-2 max-w-2xl text-gray-600">Choose your candle, pick your colors, and watch it change as you choose.</p>
        <div className="mt-8">
          {config ? (
            <CandleBuilder config={config} />
          ) : (
            <p className="rounded-lg border border-dashed p-8 text-center text-gray-500">The candle designer is not available right now. Please try again shortly.</p>
          )}
        </div>
      </main>
    </PublicSiteShell>
  );
}
