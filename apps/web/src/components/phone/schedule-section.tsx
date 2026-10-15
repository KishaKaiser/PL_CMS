'use client';

import { useEffect, useState } from 'react';

interface BookableAdvisor {
  id: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  ratePerMinute: number | string;
}

interface PhoneProfile {
  phoneNumber: string | null;
  balanceCents: number;
}

/** Keep in step with the API: how far ahead a booking must be, and how far ahead it can be. */
const MIN_LEAD_MINUTES = 30;
const MAX_ADVANCE_DAYS = 60;
const MIN_CALL_MINUTES = 2;

function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Formats a date the way <input type="datetime-local"> expects, in the visitor's own time zone. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

export function ScheduleSection({ primaryColor }: { primaryColor: string }) {
  const [advisors, setAdvisors] = useState<BookableAdvisor[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState<PhoneProfile | null>(null);
  const [picking, setPicking] = useState<BookableAdvisor | null>(null);
  const [when, setWhen] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    fetch('/api/proxy/appointments/advisors')
      .then(async (res) => {
        if (!res.ok) throw new Error(await readMessage(res, 'Could not load advisors'));
        return (await res.json()) as BookableAdvisor[];
      })
      .then(setAdvisors)
      .catch((err: unknown) => {
        setAdvisors([]);
        setLoadError(err instanceof Error ? err.message : 'Could not load advisors');
      });

    // 401/403 simply means "not signed in as a client", which is a normal state for visitors.
    fetch('/api/proxy/phone/me')
      .then((res) => (res.ok ? (res.json() as Promise<PhoneProfile>) : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  function openPicker(advisor: BookableAdvisor) {
    if (!profile) {
      window.location.href = `/login?next=${encodeURIComponent('/phone-readings')}`;
      return;
    }
    setPicking(advisor);
    setWhen('');
    setPhoneInput('');
    setError('');
    setConfirmation('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!picking || !profile) return;

    const scheduledAt = new Date(when);
    if (when === '' || Number.isNaN(scheduledAt.getTime())) {
      setError('Choose a day and time.');
      return;
    }
    if (scheduledAt.getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000) {
      setError(`Choose a time at least ${MIN_LEAD_MINUTES} minutes from now.`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      let current = profile;
      if (!current.phoneNumber) {
        const saved = await fetch('/api/proxy/phone/me', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneInput }),
        });
        if (!saved.ok) throw new Error(await readMessage(saved, 'Could not save your phone number'));
        current = (await saved.json()) as PhoneProfile;
        setProfile(current);
      }

      const res = await fetch('/api/proxy/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ advisorId: picking.id, scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not send your request'));

      setConfirmation(
        `Request sent to ${picking.displayName} for ${formatWhen(scheduledAt)}. We will message you as soon as they respond. ` +
          'You can see it under Appointments in your account.',
      );
      setPicking(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setSubmitting(false);
    }
  }

  const requiredCents = picking ? toCents(picking.ratePerMinute) * MIN_CALL_MINUTES : 0;
  const shortOnFunds = profile !== null && picking !== null && profile.balanceCents < requiredCents;
  const minInput = toLocalInput(new Date(Date.now() + MIN_LEAD_MINUTES * 60_000));
  const maxInput = toLocalInput(new Date(Date.now() + MAX_ADVANCE_DAYS * 24 * 60 * 60_000));

  return (
    <div>
      {confirmation && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {confirmation}{' '}
          <a href="/client" className="font-medium underline">
            View my appointments
          </a>
        </div>
      )}

      {loadError && <p className="mb-4 text-center text-sm text-red-600">{loadError}</p>}
      {advisors === null && !loadError && <p className="text-center text-gray-500">Loading advisors…</p>}
      {advisors !== null && advisors.length === 0 && !loadError && (
        <p className="text-center text-gray-500">No advisors are open for scheduling yet. Please check back soon.</p>
      )}

      {advisors !== null && advisors.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {advisors.map((advisor) => {
            const showImage = advisor.profileImageUrl && /^(https?:)?\//.test(advisor.profileImageUrl);
            return (
              <li key={advisor.id} className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  {showImage ? (
                    <img src={advisor.profileImageUrl ?? ''} alt={advisor.displayName} className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {advisor.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{advisor.displayName}</h3>
                    <p className="text-sm text-gray-600">{formatDollars(toCents(advisor.ratePerMinute))} / min</p>
                  </div>
                </div>
                {advisor.bio && <p className="mt-3 line-clamp-3 text-sm text-gray-600">{advisor.bio}</p>}
                <button
                  onClick={() => openPicker(advisor)}
                  className="mt-auto rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-gray-50"
                  style={{ marginTop: '1.25rem', borderColor: primaryColor, color: primaryColor }}
                >
                  Schedule a Call
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {picking && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Schedule a call with {picking.displayName}</h3>
            <p className="mt-1 text-sm text-gray-600">
              {formatDollars(toCents(picking.ratePerMinute))} per minute, charged only while you talk. {picking.displayName} will
              confirm, and we will call you at the time you choose.
            </p>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Day and time (your local time)
              <input
                type="datetime-local"
                value={when}
                min={minInput}
                max={maxInput}
                onChange={(event) => setWhen(event.target.value)}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                required
              />
            </label>

            {profile.phoneNumber ? (
              <p className="mt-3 text-sm text-gray-600">We will call {profile.phoneNumber}.</p>
            ) : (
              <label className="mt-3 block text-sm font-medium text-gray-700">
                Your phone number
                <input
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  required
                />
              </label>
            )}

            <p className={`mt-3 text-sm ${shortOnFunds ? 'text-red-600' : 'text-gray-500'}`}>
              You need at least {formatDollars(requiredCents)} ({MIN_CALL_MINUTES} minutes) in your wallet when you book, and again
              when the call is placed. Your balance is {formatDollars(profile.balanceCents)}.{' '}
              {shortOnFunds && (
                <a href={`/client/shop?amount=${Math.max(5, Math.ceil((requiredCents - profile.balanceCents) / 100))}`} className="font-medium underline">
                  Add funds
                </a>
              )}
            </p>

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? 'Sending…' : 'Send request'}
              </button>
              <button type="button" onClick={() => setPicking(null)} className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
