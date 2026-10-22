import { AdvisorApplicationForm } from '../../components/advisor-application-form';
import { PublicSiteShell } from '../../components/public-site-shell';

export const metadata = { title: 'Become an Advisor' };

/** The public Advisor Application. An admin reviews every application before anyone is invited to onboard. */
export default function BecomeAnAdvisorPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* Beside the form on a wide screen, above it on a phone. */}
          <div className="mx-auto w-full max-w-sm lg:sticky lg:top-8 lg:max-w-none">
            <img
              src="/become-an-advisor/join-our-team.webp"
              alt="A smiling witch in a black hat and lace gown holds up a glowing scroll that reads “Join Our Team” under a full moon"
              width={1122}
              height={1402}
              className="h-auto w-full rounded-2xl shadow-xl ring-1 ring-black/10"
            />
          </div>

          <div>
            <h1 className="text-4xl font-bold text-gray-950">Become an Advisor</h1>
            <p className="mt-3 text-gray-600">
              Tell us about yourself and your gifts. We review every application, and if it is a fit we will email you a link to begin onboarding.
            </p>
            <AdvisorApplicationForm />
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
