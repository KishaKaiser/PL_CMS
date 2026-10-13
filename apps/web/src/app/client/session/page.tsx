'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ActiveSession {
  id: string;
  startedAt: string;
  connectedAt?: string | null;
  nextBillAt?: string | null;
  advisorId: string;
  advisor?: { displayName: string; ratePerMinute: number | string };
  /** PENDING_CONNECTION → AWAITING_CLIENT → DIALING_ADVISOR → CONNECTED (free period) → BILLING_ACTIVE */
  status: string;
  _count?: { walletTransactions: number };
}

const POLL_INTERVAL_MS = 3000;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ClientSessionPage() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [result, setResult] = useState<{ billedMinutes: number; billedAmountCents: number; durationSeconds: number } | null>(null);
  const [error, setError] = useState('');
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const hadSession = useRef(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/billing/session/active');
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (data && data.id) {
        hadSession.current = true;
        setSession(data);
        // The wallet balance drives the low-funds notice below.
        fetch('/api/proxy/phone/me')
          .then((r) => (r.ok ? (r.json() as Promise<{ balanceCents: number }>) : null))
          .then((profile) => setBalanceCents(profile ? profile.balanceCents : null))
          .catch(() => undefined);
      } else {
        // The call vanished from the active list: the other side hung up (or it never connected).
        if (hadSession.current) setCallEnded(true);
        setSession(null);
      }
    } catch {
      // Keep the last known state; the next poll will retry.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
    const poll = setInterval(() => void loadSession(), POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [loadSession]);

  const talking = session?.status === 'CONNECTED' || session?.status === 'BILLING_ACTIVE';

  useEffect(() => {
    if (!talking) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [talking]);

  async function handleStop() {
    if (!session) return;
    setStopping(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/billing/${session.id}/stop`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data?.message ?? 'Failed to end the call');
      }
      const data = await res.json();
      hadSession.current = false;
      setSession(null);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setStopping(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading call…</p>
      </main>
    );
  }

  if (result) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-xl border bg-white p-8 shadow-md text-center max-w-sm w-full">
          <h1 className="mb-2 text-2xl font-bold text-gray-800">Call Ended</h1>
          <p className="text-gray-600">
            Duration: <span className="font-semibold">{formatTime(result.durationSeconds)}</span>
          </p>
          <p className="text-gray-600">
            Billed: <span className="font-semibold text-indigo-700">${(result.billedAmountCents / 100).toFixed(2)}</span>{' '}
            <span className="text-sm text-gray-500">({result.billedMinutes} minute{result.billedMinutes !== 1 ? 's' : ''})</span>
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <a href="/client" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
              Back to Portal
            </a>
            <a href="/client/shop" className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
              Add Funds
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-xl border bg-white p-8 shadow-md text-center max-w-sm w-full">
          <h1 className="mb-2 text-2xl font-bold text-gray-800">{callEnded ? 'Call Ended' : 'No Active Call'}</h1>
          <p className="text-gray-500 mb-6">
            {callEnded
              ? 'The call has ended. Your wallet shows the final charge.'
              : "You don't have a call in progress."}
          </p>
          <div className="flex gap-3 justify-center">
            <a href="/phone-readings" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">
              Find an Advisor
            </a>
            <a href="/client" className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
              Back to Portal
            </a>
          </div>
        </div>
      </main>
    );
  }

  const advisorName = session.advisor?.displayName ?? 'your advisor';

  if (!talking) {
    const steps: Record<string, { title: string; detail: string }> = {
      PENDING_CONNECTION: {
        title: 'Calling your phone…',
        detail: 'Answer the call on your phone. You are not charged until you are talking with your advisor.',
      },
      AWAITING_CLIENT: {
        title: 'Press 1 on your phone',
        detail: 'Press 1 on your phone to begin your call. We will then connect you to your advisor.',
      },
      DIALING_ADVISOR: {
        title: `Connecting you to ${advisorName}…`,
        detail: 'Stay on the line while we reach the advisor. You are not charged until you are talking.',
      },
    };
    const step = steps[session.status] ?? steps.PENDING_CONNECTION;

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-xl border bg-white p-8 shadow-md text-center max-w-sm w-full">
          <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Connecting
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">{step.title}</h1>
          <p className="mb-6 text-sm text-gray-500">{step.detail}</p>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleStop}
            disabled={stopping}
            className="w-full rounded-lg border border-red-300 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {stopping ? 'Cancelling…' : 'Cancel Call'}
          </button>
        </div>
      </main>
    );
  }

  const connectedAtMs = new Date(session.connectedAt ?? session.startedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - connectedAtMs) / 1000));
  const freeSecondsLeft =
    session.status === 'CONNECTED' && session.nextBillAt
      ? Math.max(0, Math.ceil((new Date(session.nextBillAt).getTime() - now) / 1000))
      : 0;
  const billedMinutes = session._count?.walletTransactions ?? 0;
  const billedSoFar = session.advisor ? billedMinutes * Number(session.advisor.ratePerMinute) : null;

  // Billing charges each minute up front, so the balance left covers this many minutes beyond the current one.
  const rateCents = session.advisor ? Math.round(Number(session.advisor.ratePerMinute) * 100) : 0;
  const minutesCovered =
    session.status === 'BILLING_ACTIVE' && balanceCents !== null && rateCents > 0
      ? Math.floor(balanceCents / rateCents)
      : null;
  const lowFunds = minutesCovered !== null && minutesCovered <= 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-xl border bg-white p-8 shadow-md text-center max-w-sm w-full">
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live
        </div>
        <h1 className="mb-1 text-2xl font-bold text-gray-800">
          {session.advisor?.displayName ?? 'Advisor Call'}
        </h1>
        <p className="mb-6 text-sm text-gray-500">Call in progress</p>

        <div className="mb-6 rounded-lg bg-indigo-50 py-6">
          <p className="text-5xl font-mono font-bold text-indigo-700">
            {formatTime(elapsed)}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {session.status === 'CONNECTED'
              ? `Free for the next ${freeSecondsLeft} second${freeSecondsLeft !== 1 ? 's' : ''}, then billing starts`
              : `${billedMinutes} min billed${billedSoFar !== null ? ` ($${billedSoFar.toFixed(2)} so far)` : ''}`}
          </p>
        </div>

        {lowFunds && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-left text-sm ${
              minutesCovered === 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <p className="font-semibold">
              {minutesCovered === 0 ? 'Your balance covers only the current minute.' : 'Your balance is running low.'}
            </p>
            <p className="mt-1">
              {minutesCovered === 0
                ? 'The call will end when this minute is over unless you add funds.'
                : 'It covers about one more minute after this one.'}{' '}
              <a href="/client/shop" target="_blank" rel="noopener" className="font-medium underline">
                Add funds
              </a>{' '}
              in a new tab and your call keeps going.
            </p>
          </div>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleStop}
          disabled={stopping}
          className="w-full rounded-lg bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {stopping ? 'Ending…' : 'End Call'}
        </button>
      </div>
    </main>
  );
}
