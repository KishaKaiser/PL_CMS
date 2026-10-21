import { AdvisorApplicationForm } from '../../components/advisor-application-form';
import { PublicSiteShell } from '../../components/public-site-shell';

export const metadata = { title: 'Become an Advisor' };

/** The public Advisor Application. An admin reviews every application before anyone is invited to onboard. */
export default function BecomeAnAdvisorPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-950">Become an Advisor</h1>
        <p className="mt-3 text-gray-600">
          Tell us about yourself and your gifts. We review every application, and if it is a fit we will email you a link to begin onboarding.
        </p>
        <AdvisorApplicationForm />
      </main>
    </PublicSiteShell>
  );
}
