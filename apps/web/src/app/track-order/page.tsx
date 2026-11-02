import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PublicSiteShell } from '../../components/public-site-shell';
import { TrackOrder } from './track-order';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false, follow: false } };

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const cookieStore = await cookies();
  // Only a hint that the visitor is signed in (so their own order can open without asking for the email); the server decides.
  const signedIn = Boolean(cookieStore.get('access_token')?.value);
  return (
    <PublicSiteShell showFooter={false}>
      <TrackOrder signedIn={signedIn} linkedOrder={first(query.order).trim().slice(0, 60)} linkToken={first(query.token).slice(0, 200)} />
    </PublicSiteShell>
  );
}
