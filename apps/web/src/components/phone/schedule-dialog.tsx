'use client';

import { useState } from 'react';
import { formatDollars, readMessage, toCents } from './phone-format';

export interface SchedulableAdvisor {
  id: string;
  displayName: string;
  ratePerMinute: number | string;
}

export interface DialogProfile {
  phoneNumber: string | null;
  balanceCents: number;
}

/** Keep in step with the API: how far ahead a booking must be, and how far ahead it can be. */
const MIN_LEAD_MINUTES = 10;
const MAX_ADVANCE_DAYS = 60;
const MIN_CALL_MINUTES = 2;

/** Formats a date the way <input type="datetime-local"> expects, in the visitor's own time zone. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

export function ScheduleDialog({
  advisor,
  profile,
  primaryColor,
  onProfileChange,
  onClose,
  onBooked,
}: {
  advisor: SchedulableAdvisor;
  profile: DialogProfile;
  primaryColor: string;
  onProfileChange: (profile: DialogProfile) => void;
  onClose: () => void;
  onBooked: (message: string) => void;
}) {
  const [when, setWhen] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const requiredCents = toCents(advisor.ratePerMinute) * MIN_CALL_MINUTES;
  const shortOnFunds = profile.balanceCents < requiredCents;
  const minInput = toLocalInput(new Date(Date.now() + MIN_LEAD_MINUTES * 60_000));
  const maxInput = toLocalInput(new Date(Date.now() + MAX_ADVANCE_DAYS * 24 * 60 * 60_000));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

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
      if (!profile.phoneNumber) {
        const saved = await fetch('/api/proxy/phone/me', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneInput }),
        });
        if (!saved.ok) throw new Error(await readMessage(saved, 'Could not save your phone number'));
        onProfileChange((await saved.json()) as DialogProfile);
      }

      const res = await fetch('/api/proxy/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ advisorId: advisor.id, scheduledAt: scheduledAt.toISOString() }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not send your request'));

      onBooked(
        `Request sent to ${advisor.displayName} for ${formatWhen(scheduledAt)}. We will message you as soon as they respond. ` +
          'You can see it under Appointments in your account.',
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send your request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Schedule a call with {advisor.displayName}</h3>
        <p className="mt-1 text-sm text-gray-600">
          {formatDollars(toCents(advisor.ratePerMinute))} per minute, charged only while you talk. {advisor.displayName} will
          confirm, and we will call you at the time you choose. If you do not pick up, we will try once more about 30 seconds
          later. If that call is missed too, the appointment is cancelled and you will need to schedule a new one.
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
          You need at least {formatDollars(requiredCents)} ({MIN_CALL_MINUTES} minutes) in your wallet when you book, and again when
          the call is placed. Your balance is {formatDollars(profile.balanceCents)}.{' '}
          {shortOnFunds && (
            <a
              href={`/client/shop?amount=${Math.max(5, Math.ceil((requiredCents - profile.balanceCents) / 100))}`}
              className="font-medium underline"
            >
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
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2.5 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
