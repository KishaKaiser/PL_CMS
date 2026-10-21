import { AdvisorOnboarding } from '../../../components/advisor-onboarding';
import { PublicSiteShell } from '../../../components/public-site-shell';

export default function AdvisorOnboardingPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-4xl font-bold text-gray-950">Advisor onboarding</h1>
        <p className="mb-8 mt-2 text-gray-600">Work through this checklist to get your advisor profile ready.</p>
        <AdvisorOnboarding />
      </main>
    </PublicSiteShell>
  );
}
