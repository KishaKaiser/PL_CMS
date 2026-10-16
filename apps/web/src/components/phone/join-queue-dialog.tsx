'use client';

import { useState } from 'react';

const WAIT_CHOICES = [15, 30, 60];

/** Asks how long the client is willing to wait, then puts them in line. */
export function JoinQueueDialog({
  advisorName,
  queueLength,
  primaryColor,
  onJoin,
  onClose,
}: {
  advisorName: string;
  queueLength: number;
  primaryColor: string;
  onJoin: (maxWaitMinutes: number) => Promise<void>;
  onClose: () => void;
}) {
  const [maxWait, setMaxWait] = useState(30);
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
        <h2 className="text-lg font-semibold text-gray-900">Join the line for {advisorName}</h2>
        <p className="mt-1 text-sm text-gray-600">
          {advisorName} is busy right now
          {queueLength > 0 ? `, with ${queueLength} ${queueLength === 1 ? 'person' : 'people'} ahead of you` : ''}. We will ring your
          phone when it is your turn, and you only pay for the minutes you talk.
        </p>
        <label className="mt-4 block text-sm font-medium text-gray-700">
          How long can you wait?
          <select
            value={maxWait}
            onChange={(event) => setMaxWait(Number(event.target.value))}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          >
            {WAIT_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          If you do not pick up when we call, your turn passes to the next person. Keep your phone nearby and your wallet funded.
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={joining}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {joining ? 'Joining…' : 'Join the line'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
