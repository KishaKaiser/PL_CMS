import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdvisorActions } from '../../../components/phone/advisor-actions';
import { formatDollars, formatTimeOfDay, toCents, WEEK_ORDER, WEEKDAYS } from '../../../components/phone/phone-format';
import { ReviewForm } from '../../../components/phone/review-form';
import { StarRating } from '../../../components/phone/star-rating';
import { PublicSiteShell } from '../../../components/public-site-shell';
import { getPublicSiteConfig } from '../../../lib/public-cms';
import { buildSeoMetadata, getSeoDescription } from '../../../lib/seo';
import { fetchApi } from '../../../lib/server-api';

// Ratings, reviews and whether the advisor is online change all the time, so never serve a stale copy.
export const dynamic = 'force-dynamic';

interface AdvisorProfile {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  ratePerMinute: number | string;
  isOnline: boolean;
  busy: boolean;
  queueEnabled: boolean;
  queueLength: number;
  schedule: {
    timezone: string | null;
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  };
  rating: { average: number | null; count: number };
  reviews: Array<{ id: string; rating: number; comment: string | null; createdAt: string; reviewerName: string }>;
}

async function getAdvisorProfile(slug: string): Promise<AdvisorProfile | null> {
  try {
    const res = await fetchApi(`/phone/advisors/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as AdvisorProfile;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [advisor, siteConfig] = await Promise.all([getAdvisorProfile(slug), getPublicSiteConfig()]);

  if (!advisor) {
    return buildSeoMetadata({
      title: 'Advisor Not Found',
      description: siteConfig.identity.tagline,
      path: `/advisors/${slug}`,
      siteName: siteConfig.identity.title,
    });
  }

  return buildSeoMetadata({
    title: `${advisor.displayName} | Phone Reading Advisor | ${siteConfig.identity.title}`,
    description: getSeoDescription(advisor.bio, `Talk with ${advisor.displayName} by phone.`),
    path: `/advisors/${advisor.slug}`,
    imageUrl: advisor.profileImageUrl ?? siteConfig.identity.logoUrl,
    siteName: siteConfig.identity.title,
  });
}

export default async function AdvisorProfilePage({ params }: Props) {
  const { slug } = await params;
  const [advisor, siteConfig] = await Promise.all([getAdvisorProfile(slug), getPublicSiteConfig()]);
  if (!advisor) notFound();

  const primaryColor = siteConfig.theme.primaryColor;
  const showImage = advisor.profileImageUrl && /^(https?:)?\//.test(advisor.profileImageUrl);

  const hoursByDay = new Map<number, string[]>();
  for (const slot of advisor.schedule.slots) {
    const hours = hoursByDay.get(slot.dayOfWeek) ?? [];
    hours.push(`${formatTimeOfDay(slot.startTime)} – ${formatTimeOfDay(slot.endTime)}`);
    hoursByDay.set(slot.dayOfWeek, hours);
  }

  return (
    <PublicSiteShell siteConfig={siteConfig}>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <nav className="mb-6 text-sm text-gray-500">
          <Link href="/phone-readings" className="hover:underline">
            ← All advisors
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                {showImage ? (
                  <img src={advisor.profileImageUrl ?? ''} alt={advisor.displayName} className="h-40 w-40 rounded-full object-cover" />
                ) : (
                  <div
                    className="flex h-40 w-40 items-center justify-center rounded-full text-6xl font-semibold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {advisor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <h1 className="mt-4 text-2xl font-bold text-gray-950">{advisor.displayName}</h1>

                {advisor.rating.average !== null ? (
                  <a href="#ratings" className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:underline">
                    <StarRating value={advisor.rating.average} />
                    <span>
                      {advisor.rating.average.toFixed(1)} ({advisor.rating.count} review{advisor.rating.count === 1 ? '' : 's'})
                    </span>
                  </a>
                ) : (
                  <p className="mt-2 text-sm text-gray-500">No reviews yet</p>
                )}

                <p className="mt-3 text-lg font-semibold text-gray-900">{formatDollars(toCents(advisor.ratePerMinute))} per minute</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${
                    !advisor.isOnline ? 'text-gray-500' : advisor.busy ? 'text-amber-700' : 'text-green-700'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${!advisor.isOnline ? 'bg-gray-400' : advisor.busy ? 'bg-amber-500' : 'bg-green-500'}`}
                  />
                  {!advisor.isOnline ? 'Offline' : advisor.busy ? 'On another call' : 'Available now'}
                </p>
              </div>

              <div className="mt-6">
                <AdvisorActions
                  advisor={{
                    id: advisor.id,
                    slug: advisor.slug,
                    displayName: advisor.displayName,
                    ratePerMinute: advisor.ratePerMinute,
                    isOnline: advisor.isOnline,
                    busy: advisor.busy,
                    queueEnabled: advisor.queueEnabled,
                    queueLength: advisor.queueLength,
                  }}
                  primaryColor={primaryColor}
                />
              </div>
            </div>
          </aside>

          <div className="space-y-8 lg:col-span-2">
            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-950">About {advisor.displayName}</h2>
              {advisor.bio ? (
                <p className="mt-3 whitespace-pre-line text-gray-700">{advisor.bio}</p>
              ) : (
                <p className="mt-3 text-gray-500">This advisor has not added a description yet.</p>
              )}
            </section>

            <section className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-950">Weekly schedule</h2>
              {advisor.schedule.slots.length === 0 ? (
                <p className="mt-3 text-gray-500">
                  {advisor.displayName} has not posted regular hours. You can still request a call at a time that suits you.
                </p>
              ) : (
                <>
                  <dl className="mt-3 divide-y">
                    {WEEK_ORDER.map((day) => (
                      <div key={day} className="flex justify-between gap-4 py-2 text-sm">
                        <dt className="font-medium text-gray-900">{WEEKDAYS[day]}</dt>
                        <dd className="text-right text-gray-700">
                          {hoursByDay.get(day)?.join(', ') ?? <span className="text-gray-400">Not available</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {advisor.schedule.timezone && (
                    <p className="mt-3 text-xs text-gray-500">All times are in {advisor.schedule.timezone.replace(/_/g, ' ')} time.</p>
                  )}
                </>
              )}
            </section>

            <section id="ratings" className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-950">Ratings and comments</h2>

              {advisor.rating.average !== null && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-4xl font-bold text-gray-950">{advisor.rating.average.toFixed(1)}</span>
                  <div>
                    <StarRating value={advisor.rating.average} className="text-2xl" />
                    <p className="text-sm text-gray-500">
                      Based on {advisor.rating.count} review{advisor.rating.count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5">
                <ReviewForm slug={advisor.slug} advisorName={advisor.displayName} primaryColor={primaryColor} />
              </div>

              {advisor.reviews.length === 0 ? (
                <p className="text-gray-500">No reviews yet. Be the first to share your experience.</p>
              ) : (
                <ul className="divide-y">
                  {advisor.reviews.map((review) => (
                    <li key={review.id} className="py-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <StarRating value={review.rating} className="text-base" />
                        <span className="text-sm font-medium text-gray-900">{review.reviewerName}</span>
                        <span className="text-sm text-gray-400">
                          {new Date(review.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                        </span>
                      </div>
                      {review.comment && <p className="mt-2 whitespace-pre-line text-gray-700">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>
    </PublicSiteShell>
  );
}
