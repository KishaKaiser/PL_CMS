'use client';

import { useEffect, useState } from 'react';
import { formatDollars, readMessage, toCents } from './phone-format';

export interface PhoneProfile {
  phoneNumber: string | null;
  balanceCents: number;
}

/** A client needs this many minutes of the advisor's rate in their wallet to start a call. */
export const MIN_CALL_MINUTES = 2;

/** The signed-in client's phone number and wallet balance; null for visitors who are not signed in as a client. */
export function usePhoneProfile() {
  const [profile, setProfile] = useState<PhoneProfile | null>(null);

  useEffect(() => {
    // 401/403 simply means "not signed in as a client", which is a normal state for visitors.
    fetch('/api/proxy/phone/me')
      .then((res) => (res.ok ? (res.json() as Promise<PhoneProfile>) : null))
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  return { profile, setProfile };
}

/** The message and Add Funds suggestion to show when the wallet is too low for a call, or null if it is enough. */
export function fundsNotice(advisorName: string, ratePerMinute: number | string, profile: PhoneProfile) {
  const requiredCents = toCents(ratePerMinute) * MIN_CALL_MINUTES;
  if (profile.balanceCents >= requiredCents) return null;
  return {
    text: `You need at least ${formatDollars(requiredCents)} (${MIN_CALL_MINUTES} minutes) in your wallet to call ${advisorName}. You have ${formatDollars(profile.balanceCents)}.`,
    // Pre-fill the Add Funds page with what they are short by (it enforces its own $5 minimum).
    suggestedDollars: Math.ceil((requiredCents - profile.balanceCents) / 100),
  };
}

/** Starts the call: we ring the client first, then the advisor. Throws with the server's message on failure. */
export async function startCallRequest(advisorId: string): Promise<void> {
  const res = await fetch('/api/proxy/billing/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ advisorId }),
  });
  if (!res.ok) throw new Error(await readMessage(res, 'Could not start the call'));
}

export function loginUrl(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/** Fired after joining or leaving a queue so the "your place in line" notice refreshes right away. */
export const QUEUE_CHANGED_EVENT = 'callback-queue-changed';

/** Puts the client in line for a busy advisor; we ring them when it is their turn. Throws with the server's message on failure. */
export async function joinQueueRequest(advisorId: string, maxWaitMinutes: number): Promise<void> {
  const res = await fetch('/api/proxy/callbacks/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ advisorId, maxWaitMinutes }),
  });
  if (!res.ok) throw new Error(await readMessage(res, 'Could not join the line'));
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}
