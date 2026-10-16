'use client';

import { useState } from 'react';

const BUSY_CHOICES = [
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
];

/** For an advisor who is offline: how long to keep the request open until they come online. */
const OFFLINE_CHOICES = [
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 360, label: '6 hours' },
  { minutes: 720, label: '12 hours' },
  { minutes: 1440, label: '24 hours' },
  { minutes: 999 * 60, label: 'As long as it takes (no limit)' },
];

/** Asks how long the client is willing to wait, then puts them in line. */
export function JoinQueueDialog({
  advisorName,
  offline,
  queueLength,
  primaryColor,
  onJoin,
  onClose,
}: {
  advisorName: string;
  /** The advisor is offline: this is a callback request for when they come online. */
  offline: boolean;
  queueLength: number;
  primaryColor: string;
  onJoin: (maxWaitMinutes: number) => Promise<void>;
  onClose: () => void;
}) {
  const choices = offline ? OFFLINE_CHOICES : BUSY_CHOICES;
  const [maxWait, setMaxWait] = useState(offline ? OFFLINE_CHOICES[OFFLINE_CHOICES.length - 1].minutes : 30);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setJoining(true);
    setError('');
    try {
      await onJoin(maxWait);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join the line');
      setJoining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          {offline ? `Request a callback from ${advisorName}` : `Join the line for ${advisorName}`}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {offline ? `${advisorName} is offline right now` : `${advisorName} is busy right now`}
          {queueLength > 0 ? `, with ${queueLength} ${queueLength === 1 ? 'person' : 'people'} ahead of you` : ''}.{' '}
          {offline
            ? 'As soon as they come online we will ring your phone, in the order people asked.'
            : 'We will ring your phone when it is your turn.'}{' '}
          You only pay for the minutes you talk.
        </p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          How long can you wait?
          <select
            value={maxWait}
            onChange={(event) => setMaxWait(Number(event.target.value))}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            {choices.map((choice) => (
              <option key={choice.minutes} value={choice.minutes}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          We call you up to twice, about 30 seconds apart. If you do not pick up, your turn passes to the next person. Keep your phone nearby and your wallet funded.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={joining}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {joining ? 'Sending…' : offline ? 'Request callback' : 'Join the line'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
