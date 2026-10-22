import { AdvisorApplicationForm } from '../../components/advisor-application-form';
import { PublicSiteShell } from '../../components/public-site-shell';

export const metadata = { title: 'Become an Advisor' };

const REASONS = [
  'Choose your own hours',
  'Work from anywhere',
  'Keep doing what you love',
  'Connect with new clients',
  'Showcase your unique gifts',
  'Supportive advisor community',
  'Flexible scheduling',
  'Grow your spiritual practice',
];

/** The public Advisor Application. An admin reviews every application before anyone is invited to onboard. */
export default function BecomeAnAdvisorPage() {
  return (
    <PublicSiteShell>
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          {/* Stays in view while the form scrolls on a wide screen; above the form on a phone. On a short screen the picture is
              a little smaller so the picture and the box under it both fit. */}
          <div className="mx-auto w-full max-w-sm space-y-4 lg:sticky lg:top-6 lg:max-w-none">
            <img
              src="/become-an-advisor/join-our-team.webp"
              alt="A smiling witch in a black hat and lace gown holds up a glowing scroll that reads “Join Our Team” under a full moon"
              width={1122}
              height={1402}
              className="mx-auto h-auto w-full rounded-2xl shadow-xl ring-1 ring-black/10 lg:w-auto lg:max-h-[46vh] lg:max-w-full"
            />

            <section aria-labelledby="why-join" className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm">
              <h2 id="why-join" className="text-lg font-bold text-purple-900">
                Why Join The Psychic Link?
              </h2>
              <ul className="mt-3 space-y-1.5">
                {REASONS.map((reason) => (
                  <li key={reason} className="flex items-start gap-2.5 text-sm text-gray-800">
                    <span aria-hidden="true" className="mt-0.5 text-purple-600">
                      ✦
                    </span>
                    {reason}
                  </li>
                ))}
              </ul>
            </section>
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
