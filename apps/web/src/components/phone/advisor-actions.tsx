'use client';

import { useEffect, useState } from 'react';
import { CallbackQueueStatus } from './callback-queue-status';
import { JoinQueueDialog } from './join-queue-dialog';
import { fundsNotice, joinQueueRequest, loginUrl, startCallRequest, usePhoneProfile, type PhoneProfile } from './phone-client';
import { PhonePromptDialog } from './phone-prompt-dialog';
import { formatDollars } from './phone-format';
import { ScheduleDialog } from './schedule-dialog';

const STATUS_REFRESH_MS = 15_000;

interface Advisor {
  id: string;
  slug: string;
  displayName: string;
  ratePerMinute: number | string;
  isOnline: boolean;
  busy: boolean;
  queueEnabled: boolean;
  queueLength: number;
}

/** Call Now and Schedule a Call for one advisor, shown on their public profile page. */
export function AdvisorActions({ advisor, primaryColor }: { advisor: Advisor; primaryColor: string }) {
  const { profile, setProfile } = usePhoneProfile();
  const [status, setStatus] = useState({
    isOnline: advisor.isOnline,
    busy: advisor.busy,
    queueEnabled: advisor.queueEnabled,
    queueLength: advisor.queueLength,
  });
  const [calling, setCalling] = useState(false);
  const [notice, setNotice] = useState<{ text: string; suggestedDollars?: number } | null>(null);
  const [askPhone, setAskPhone] = useState(false);
  const [phoneIntent, setPhoneIntent] = useState<'call' | 'queue'>('call');
  const [joiningQueue, setJoiningQueue] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  // The page is loaded once, but the advisor can go online or start a call while a client is reading it.
  useEffect(() => {
    const refresh = setInterval(() => {
      fetch(`/api/proxy/phone/advisors/${encodeURIComponent(advisor.slug)}`)
        .then((res) => (res.ok ? (res.json() as Promise<typeof status>) : null))
        .then((fresh) => {
          if (fresh) {
            setStatus({
              isOnline: fresh.isOnline,
              busy: fresh.busy,
              queueEnabled: fresh.queueEnabled,
              queueLength: fresh.queueLength,
            });
          }
        })
        .catch(() => undefined);
    }, STATUS_REFRESH_MS);
    return () => clearInterval(refresh);
  }, [advisor.slug]);

  const returnTo = `/advisors/${advisor.slug}`;
  const unavailable = !status.isOnline || status.busy;
  const canQueue = status.isOnline && status.busy && status.queueEnabled;

  async function startCall(current: PhoneProfile) {
    const shortfall = fundsNotice(advisor.displayName, advisor.ratePerMinute, current);
    if (shortfall) {
      setNotice(shortfall);
      return;
    }

    setCalling(true);
    setNotice(null);
    try {
      await startCallRequest(advisor.id);
      window.location.href = '/client/session';
    } catch (err: unknown) {
      setNotice({ text: err instanceof Error ? err.message : 'Could not start the call' });
      setCalling(false);
    }
  }

  function handleCallNow() {
    setConfirmation('');
    if (!profile) {
      window.location.href = loginUrl(returnTo);
      return;
    }
    if (!profile.phoneNumber) {
      setPhoneIntent('call');
      setAskPhone(true);
      return;
    }
    void startCall(profile);
  }

  function openQueue(current: PhoneProfile) {
    const shortfall = fundsNotice(advisor.displayName, advisor.ratePerMinute, current);
    if (shortfall) {
      setNotice(shortfall);
      return;
    }
    setNotice(null);
    setJoiningQueue(true);
  }

  function handleJoinQueue() {
    setConfirmation('');
    if (!profile) {
      window.location.href = loginUrl(returnTo);
      return;
    }
    if (!profile.phoneNumber) {
      setPhoneIntent('queue');
      setAskPhone(true);
      return;
    }
    openQueue(profile);
  }

  function handleSchedule() {
    setNotice(null);
    setConfirmation('');
    if (!profile) {
      window.location.href = loginUrl(returnTo);
      return;
    }
    setScheduling(true);
  }

  const label = calling ? 'Calling…' : !status.isOnline ? 'Currently offline' : status.busy ? 'On another call' : 'Call Now';

  return (
    <div className="grid gap-3">
      <CallbackQueueStatus />

      {profile && (
        <p className="text-sm text-gray-600">
          Wallet balance: <span className="font-semibold">{formatDollars(profile.balanceCents)}</span>{' '}
          <a href="/client/shop" className="font-medium underline" style={{ color: primaryColor }}>
            Add Funds
          </a>
        </p>
      )}

      {canQueue ? (
        <button
          onClick={handleJoinQueue}
          className="w-full rounded-lg py-3 text-base font-semibold text-white"
          style={{ backgroundColor: primaryColor }}
        >
          Join the line{status.queueLength > 0 ? ` (${status.queueLength} waiting)` : ''}
        </button>
      ) : (
        <button
          onClick={handleCallNow}
          disabled={unavailable || calling}
          className="w-full rounded-lg py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          {label}
        </button>
      )}

      <button
        onClick={handleSchedule}
        disabled={calling}
        className="w-full rounded-lg border py-3 text-base font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: primaryColor, color: primaryColor }}
      >
        Schedule a Call
      </button>

      {!status.isOnline && (
        <p className="text-sm text-gray-500">{advisor.displayName} is not taking calls right now. You can schedule a call for later.</p>
      )}

      {notice && (
        <p className="text-sm text-red-600">
          {notice.text}{' '}
          {notice.suggestedDollars !== undefined && (
            <a href={`/client/shop?amount=${Math.max(5, notice.suggestedDollars)}`} className="font-medium underline">
              Add funds
            </a>
          )}
        </p>
      )}

      {confirmation && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {confirmation}{' '}
          <a href="/client" className="font-medium underline">
            View my appointments
          </a>
        </div>
      )}

      {askPhone && (
        <PhonePromptDialog
          advisorName={advisor.displayName}
          primaryColor={primaryColor}
          onClose={() => setAskPhone(false)}
          onSaved={(saved) => {
            setProfile(saved);
            setAskPhone(false);
            if (phoneIntent === 'queue') openQueue(saved);
            else void startCall(saved);
          }}
        />
      )}

      {joiningQueue && (
        <JoinQueueDialog
          advisorName={advisor.displayName}
          queueLength={status.queueLength}
          primaryColor={primaryColor}
          onJoin={async (maxWaitMinutes) => {
            await joinQueueRequest(advisor.id, maxWaitMinutes);
            setJoiningQueue(false);
          }}
          onClose={() => setJoiningQueue(false)}
        />
      )}

      {scheduling && profile && (
        <ScheduleDialog
          advisor={advisor}
          profile={profile}
          primaryColor={primaryColor}
          onProfileChange={setProfile}
          onClose={() => setScheduling(false)}
          onBooked={(message) => {
            setScheduling(false);
            setConfirmation(message);
          }}
        />
      )}
    </div>
  );
}
