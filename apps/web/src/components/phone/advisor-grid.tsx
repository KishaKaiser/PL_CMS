'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDollars, readMessage, toCents } from './phone-format';
import { ScheduleDialog } from './schedule-dialog';

interface AdvisorCard {
  id: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  ratePerMinute: number | string;
  isOnline: boolean;
  busy: boolean;
}

interface PhoneProfile {
  phoneNumber: string | null;
  balanceCents: number;
}

/** A client needs this many minutes of the advisor's rate in their wallet to start a call. */
const MIN_CALL_MINUTES = 2;
const REFRESH_INTERVAL_MS = 15_000;

export function AdvisorGrid({ primaryColor }: { primaryColor: string }) {
  const [advisors, setAdvisors] = useState<AdvisorCard[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [profile, setProfile] = useState<PhoneProfile | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ advisorId: string; text: string; needsFunds?: boolean; suggestedDollars?: number } | null>(null);
  const [phoneFor, setPhoneFor] = useState<AdvisorCard | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [scheduling, setScheduling] = useState<AdvisorCard | null>(null);
  const [confirmation, setConfirmation] = useState('');

  const loadAdvisors = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/phone/advisors');
      if (!res.ok) throw new Error(await readMessage(res, 'Could not load advisors'));
      setAdvisors((await res.json()) as AdvisorCard[]);
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Could not load advisors');
    }
  }, []);

  useEffect(() => {
    void loadAdvisors();
    const refresh = setInterval(() => void loadAdvisors(), REFRESH_INTERVAL_MS);
    return () => clearInterval(refresh);
  }, [loadAdvisors]);

  useEffect(() => {
    // 401/403 simply means "not signed in as a client", which is a normal state for visitors.
    fetch('/api/proxy/phone/me')
      .then((res) => (res.ok ? (res.json() as Promise<PhoneProfile>) : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  async function startCall(advisor: AdvisorCard, currentProfile: PhoneProfile) {
    const requiredCents = toCents(advisor.ratePerMinute) * MIN_CALL_MINUTES;
    if (currentProfile.balanceCents < requiredCents) {
      setNotice({
        advisorId: advisor.id,
        text: `You need at least ${formatDollars(requiredCents)} (${MIN_CALL_MINUTES} minutes) in your wallet to call ${advisor.displayName}. You have ${formatDollars(currentProfile.balanceCents)}.`,
        needsFunds: true,
        // Pre-fill the Add Funds page with what they are short by (it enforces its own $5 minimum).
        suggestedDollars: Math.ceil((requiredCents - currentProfile.balanceCents) / 100),
      });
      return;
    }

    setCallingId(advisor.id);
    setNotice(null);
    try {
      const res = await fetch('/api/proxy/billing/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ advisorId: advisor.id }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not start the call'));
      window.location.href = '/client/session';
    } catch (err: unknown) {
      setNotice({ advisorId: advisor.id, text: err instanceof Error ? err.message : 'Could not start the call' });
      setCallingId(null);
      void loadAdvisors();
    }
  }

  function handleCallNow(advisor: AdvisorCard) {
    setConfirmation('');
    if (!profile) {
      window.location.href = `/login?next=${encodeURIComponent('/phone-readings')}`;
      return;
    }
    if (!profile.phoneNumber) {
      setPhoneFor(advisor);
      setPhoneInput('');
      setPhoneError('');
      return;
    }
    void startCall(advisor, profile);
  }

  function handleSchedule(advisor: AdvisorCard) {
    setNotice(null);
    setConfirmation('');
    if (!profile) {
      window.location.href = `/login?next=${encodeURIComponent('/phone-readings')}`;
      return;
    }
    setScheduling(advisor);
  }

  async function handleSavePhone(event: React.FormEvent) {
    event.preventDefault();
    if (!phoneFor) return;
    setSavingPhone(true);
    setPhoneError('');
    try {
      const res = await fetch('/api/proxy/phone/me', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneInput }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save your phone number'));
      const saved = (await res.json()) as PhoneProfile;
      setProfile(saved);
      const advisor = phoneFor;
      setPhoneFor(null);
      void startCall(advisor, saved);
    } catch (err: unknown) {
      setPhoneError(err instanceof Error ? err.message : 'Could not save your phone number');
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <div>
      {profile && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-sm">
          <p>
            Wallet balance: <span className="font-semibold">{formatDollars(profile.balanceCents)}</span>
            {profile.phoneNumber && <span className="ml-3 text-gray-500">We will call {profile.phoneNumber}</span>}
          </p>
          <a href="/client/shop" className="font-medium underline" style={{ color: primaryColor }}>
            Add Funds
          </a>
        </div>
      )}

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

      {advisors !== null && advisors.length === 0 && (
        <p className="text-center text-gray-500">
          No advisors are available yet. This page refreshes on its own, so check back in a moment.
        </p>
      )}

      {advisors !== null && advisors.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {advisors.map((advisor) => {
            const showImage = advisor.profileImageUrl && /^(https?:)?\//.test(advisor.profileImageUrl);
            const calling = callingId === advisor.id;
            const offline = !advisor.isOnline;
            const unavailable = offline || advisor.busy;
            const statusText = offline ? 'Offline' : advisor.busy ? 'On another call' : 'Available now';
            const statusColor = offline ? 'text-gray-500' : advisor.busy ? 'text-amber-700' : 'text-green-700';
            const dotColor = offline ? 'bg-gray-400' : advisor.busy ? 'bg-amber-500' : 'bg-green-500';
            return (
              <li key={advisor.id} className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  {showImage ? (
                    <img src={advisor.profileImageUrl ?? ''} alt={advisor.displayName} className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {advisor.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{advisor.displayName}</h2>
                    <p className="text-sm text-gray-600">{formatDollars(toCents(advisor.ratePerMinute))} / min</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                      <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                      {statusText}
                    </p>
                  </div>
                </div>

                {advisor.bio && <p className="mt-4 line-clamp-3 text-sm text-gray-600">{advisor.bio}</p>}

                <div className="mt-auto grid gap-2 pt-5">
                  <button
                    onClick={() => handleCallNow(advisor)}
                    disabled={unavailable || callingId !== null}
                    className="w-full rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {calling ? 'Calling…' : offline ? 'Offline' : advisor.busy ? 'Unavailable' : 'Call Now'}
                  </button>
                  <button
                    onClick={() => handleSchedule(advisor)}
                    disabled={callingId !== null}
                    className="w-full rounded-lg border py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    Schedule a Call
                  </button>
                  {notice?.advisorId === advisor.id && (
                    <p className="text-sm text-red-600">
                      {notice.text}{' '}
                      {notice.needsFunds && (
                        <a
                          href={notice.suggestedDollars ? `/client/shop?amount=${Math.max(5, notice.suggestedDollars)}` : '/client/shop'}
                          className="font-medium underline"
                        >
                          Add funds
                        </a>
                      )}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {scheduling && profile && (
        <ScheduleDialog
          advisor={scheduling}
          profile={profile}
          primaryColor={primaryColor}
          onProfileChange={setProfile}
          onClose={() => setScheduling(null)}
          onBooked={(message) => {
            setScheduling(null);
            setConfirmation(message);
          }}
        />
      )}

      {phoneFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSavePhone} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Where should we call you?</h2>
            <p className="mt-1 text-sm text-gray-600">
              We will ring this number, then connect you to {phoneFor.displayName}.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700">
              Your phone number
              <input
                value={phoneInput}
                onChange={(event) => setPhoneInput(event.target.value)}
                type="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                autoFocus
              />
            </label>
            {phoneError && <p className="mt-2 text-sm text-red-600">{phoneError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={savingPhone || phoneInput.trim() === ''}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {savingPhone ? 'Saving…' : 'Save and call'}
              </button>
              <button
                type="button"
                onClick={() => setPhoneFor(null)}
                className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
