'use client';

import { useCallback, useEffect, useState } from 'react';
import { CallbackQueueStatus } from './callback-queue-status';
import { JoinQueueDialog } from './join-queue-dialog';
import { fundsNotice, joinQueueRequest, loginUrl, startCallRequest, usePhoneProfile, type PhoneProfile } from './phone-client';
import { PhonePromptDialog } from './phone-prompt-dialog';
import { formatDollars, readMessage, toCents } from './phone-format';

interface AdvisorCard {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  ratePerMinute: number | string;
  busy: boolean;
  queueEnabled: boolean;
  queueLength: number;
}

const REFRESH_INTERVAL_MS = 15_000;

export function AdvisorGrid({ primaryColor }: { primaryColor: string }) {
  const [advisors, setAdvisors] = useState<AdvisorCard[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const { profile, setProfile } = usePhoneProfile();
  const [callingId, setCallingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ advisorId: string; text: string; needsFunds?: boolean; suggestedDollars?: number } | null>(null);
  const [phoneFor, setPhoneFor] = useState<AdvisorCard | null>(null);
  // What to do once the client has given their phone number: call now, or join the line.
  const [phoneIntent, setPhoneIntent] = useState<'call' | 'queue'>('call');
  const [queueFor, setQueueFor] = useState<AdvisorCard | null>(null);

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

  async function startCall(advisor: AdvisorCard, currentProfile: PhoneProfile) {
    const shortfall = fundsNotice(advisor.displayName, advisor.ratePerMinute, currentProfile);
    if (shortfall) {
      setNotice({ advisorId: advisor.id, text: shortfall.text, needsFunds: true, suggestedDollars: shortfall.suggestedDollars });
      return;
    }

    setCallingId(advisor.id);
    setNotice(null);
    try {
      await startCallRequest(advisor.id);
      window.location.href = '/client/session';
    } catch (err: unknown) {
      setNotice({ advisorId: advisor.id, text: err instanceof Error ? err.message : 'Could not start the call' });
      setCallingId(null);
      void loadAdvisors();
    }
  }

  function handleCallNow(advisor: AdvisorCard) {
    if (!profile) {
      window.location.href = loginUrl('/phone-readings');
      return;
    }
    if (!profile.phoneNumber) {
      setPhoneIntent('call');
      setPhoneFor(advisor);
      return;
    }
    void startCall(advisor, profile);
  }

  function openQueue(advisor: AdvisorCard, current: PhoneProfile) {
    const shortfall = fundsNotice(advisor.displayName, advisor.ratePerMinute, current);
    if (shortfall) {
      setNotice({ advisorId: advisor.id, text: shortfall.text, needsFunds: true, suggestedDollars: shortfall.suggestedDollars });
      return;
    }
    setNotice(null);
    setQueueFor(advisor);
  }

  function handleJoinQueue(advisor: AdvisorCard) {
    if (!profile) {
      window.location.href = loginUrl('/phone-readings');
      return;
    }
    if (!profile.phoneNumber) {
      setPhoneIntent('queue');
      setPhoneFor(advisor);
      return;
    }
    openQueue(advisor, profile);
  }

  async function joinQueue(advisor: AdvisorCard, maxWaitMinutes: number) {
    await joinQueueRequest(advisor.id, maxWaitMinutes);
    setQueueFor(null);
    void loadAdvisors();
  }

  return (
    <div>
      <CallbackQueueStatus />

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

      {loadError && <p className="mb-4 text-center text-sm text-red-600">{loadError}</p>}

      {advisors === null && !loadError && <p className="text-center text-gray-500">Loading advisors…</p>}

      {advisors !== null && advisors.length === 0 && (
        <p className="text-center text-gray-500">
          No advisors are taking calls right now. This page refreshes on its own, so check back in a moment.
        </p>
      )}

      {advisors !== null && advisors.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {advisors.map((advisor) => {
            const showImage = advisor.profileImageUrl && /^(https?:)?\//.test(advisor.profileImageUrl);
            const calling = callingId === advisor.id;
            const profileHref = `/advisors/${advisor.slug}`;
            return (
              <li key={advisor.id} className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
                <a href={profileHref} className="flex items-center gap-4" aria-label={`View ${advisor.displayName}'s profile`}>
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
                    <h2 className="text-lg font-semibold text-gray-900 hover:underline">{advisor.displayName}</h2>
                    <p className="text-sm text-gray-600">{formatDollars(toCents(advisor.ratePerMinute))} / min</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${advisor.busy ? 'text-amber-700' : 'text-green-700'}`}>
                      <span className={`h-2 w-2 rounded-full ${advisor.busy ? 'bg-amber-500' : 'bg-green-500'}`} />
                      {advisor.busy
                        ? `On another call${advisor.queueLength > 0 ? ` · ${advisor.queueLength} waiting` : ''}`
                        : 'Available now'}
                    </p>
                  </div>
                </a>

                {advisor.bio && <p className="mt-4 line-clamp-3 text-sm text-gray-600">{advisor.bio}</p>}

                <div className="mt-auto grid gap-2 pt-5">
                  {advisor.busy && (advisor.queueEnabled || advisor.queueLength > 0) ? (
                    <button
                      onClick={() => handleJoinQueue(advisor)}
                      disabled={callingId !== null}
                      className="w-full rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Join the line
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCallNow(advisor)}
                      disabled={advisor.busy || callingId !== null}
                      className="w-full rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {calling ? 'Calling…' : advisor.busy ? 'Unavailable' : 'Call Now'}
                    </button>
                  )}
                  <a
                    href={profileHref}
                    className="text-center text-sm font-medium underline"
                    style={{ color: primaryColor }}
                  >
                    View profile, ratings and schedule
                  </a>
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

      {phoneFor && (
        <PhonePromptDialog
          advisorName={phoneFor.displayName}
          primaryColor={primaryColor}
          onClose={() => setPhoneFor(null)}
          onSaved={(saved) => {
            const advisor = phoneFor;
            setProfile(saved);
            setPhoneFor(null);
            if (phoneIntent === 'queue') openQueue(advisor, saved);
            else void startCall(advisor, saved);
          }}
        />
      )}

      {queueFor && (
        <JoinQueueDialog
          advisorName={queueFor.displayName}
          offline={false}
          queueLength={queueFor.queueLength}
          primaryColor={primaryColor}
          onJoin={(maxWaitMinutes) => joinQueue(queueFor, maxWaitMinutes)}
          onClose={() => setQueueFor(null)}
        />
      )}
    </div>
  );
}
