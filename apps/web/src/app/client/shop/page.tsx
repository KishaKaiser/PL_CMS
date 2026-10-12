import { AddFundsPacks } from '../../../components/phone/add-funds-packs';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { getPublicSiteConfig } from '../../../lib/public-cms';

export default async function AddFundsPage() {
  const siteConfig = await getPublicSiteConfig();

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-gray-950">Add Funds</h1>
          <p className="mt-3 text-gray-600">
            Add money to your wallet to pay for phone readings. You are charged per minute, only while you are talking.
          </p>
        </header>

        <AddFundsPacks primaryColor={siteConfig.theme.primaryColor} />

        <div className="mt-10 flex justify-center gap-6 text-sm">
          <a href="/client" className="underline" style={{ color: siteConfig.theme.primaryColor }}>
            Back to Portal
          </a>
          <a href="/phone-readings" className="underline" style={{ color: siteConfig.theme.primaryColor }}>
            Find an Advisor
          </a>
        </div>
      </main>
    </PublicSiteShell>
  );
}
