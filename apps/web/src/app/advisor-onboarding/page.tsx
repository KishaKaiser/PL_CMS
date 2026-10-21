import { Suspense } from 'react';
import { ActivateForm } from '../../components/advisor-activate-form';
import { PublicSiteShell } from '../../components/public-site-shell';

export const metadata = { title: 'Advisor onboarding' };

export default function AdvisorOnboardingActivationPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <h1 className="mb-6 text-4xl font-bold text-gray-950">Advisor onboarding</h1>
        <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
          <ActivateForm />
        </Suspense>
      </main>
    </PublicSiteShell>
  );
}
