'use client';

import { useCallback, useEffect, useState } from 'react';
import { QUEUE_CHANGED_EVENT } from './phone-client';
import { readMessage } from './phone-format';

interface QueueEntry {
  id: string;
  status: 'WAITING' | 'CALLING';
  position: number;
  expiresAt: string;
  advisor: { id: string; displayName: string; slug: string | null; isOnline: boolean };
}

interface RecentOutcome {
  id: string;
  note: string;
  advisorName: string;
}

const REFRESH_INTERVAL_MS = 8_000;

/** The signed-in client's place in a callback line, or why their last turn ended. Shows nothing for everyone else. */
export function CallbackQueueStatus() {
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [recent, setRecent] = useState<RecentOutcome | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/callbacks/mine');
      if (!res.ok) return; // not signed in as a client: nothing to show
      const data = (await res.json()) as { role: string; entry?: QueueEntry | null; recent?: RecentOutcome | null };
      if (data.role !== 'client') return;
      setEntry(data.entry ?? null);
      setRecent(data.recent ?? null);
    } catch {
      // Keep what is on screen; the next refresh will retry.
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => {
      clearInterval(refresh);
      window.removeEventListener(QUEUE_CHANGED_EVENT, load);
    };
  }, [load]);

  async function leave() {
    if (!entry) return;
    setLeaving(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/callbacks/${entry.id}/leave`, { method: 'POST' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not leave the line'));
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not leave the line');
    } finally {
      setLeaving(false);
    }
  }

  if (entry) {
    const calling = entry.status === 'CALLING';
    return (
      <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900" role="status">
        {calling ? (
          <p>
            <span className="font-semibold">We are calling you now</span> to connect you with {entry.advisor.displayName}. Answer
            your phone and press 1.{' '}
            <a href="/client/session" className="font-medium underline">
              See my call
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-semibold">
                You are #{entry.position} in line for {entry.advisor.displayName}.
              </span>{' '}
              {entry.advisor.isOnline
                ? 'We will ring your phone when it is your turn.'
                : `We will ring your phone as soon as ${entry.advisor.displayName} comes online.`}{' '}
              Keep your wallet funded and your phone nearby.
            </p>
            <button
              type="button"
              onClick={() => void leave()}
              disabled={leaving}
              className="rounded-lg border border-purple-300 bg-white px-3 py-1.5 font-medium hover:bg-purple-100 disabled:opacity-50"
            >
              {leaving ? 'Leaving…' : entry.advisor.isOnline ? 'Leave the line' : 'Cancel request'}
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-red-600">{error}</p>}
      </div>
    );
  }

  if (recent && dismissed !== recent.id) {
    return (
      <div
        className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        role="status"
      >
        <p>
          <span className="font-semibold">Your place in line for {recent.advisorName} ended.</span> {recent.note}
        </p>
        <button type="button" onClick={() => setDismissed(recent.id)} className="font-medium underline">
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
