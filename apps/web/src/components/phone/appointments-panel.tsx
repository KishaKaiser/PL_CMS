'use client';

import { useCallback, useEffect, useState } from 'react';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  note: string | null;
  advisor: { id: string; displayName: string; ratePerMinute: number | string };
  client: { displayName: string };
}

type Mode = 'client' | 'advisor';

const REFRESH_INTERVAL_MS = 30_000;

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Waiting for response', className: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: 'Confirmed', className: 'bg-green-100 text-green-800' },
  IN_PROGRESS: { label: 'Calling now', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-700' },
  MISSED: { label: 'Missed', className: 'bg-red-100 text-red-800' },
  DECLINED: { label: 'Declined', className: 'bg-gray-100 text-gray-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
  EXPIRED: { label: 'Expired', className: 'bg-gray-100 text-gray-700' },
};

const UPCOMING_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' });
}

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

export function AppointmentsPanel({ mode }: { mode: Mode }) {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/appointments/mine');
      if (!res.ok) throw new Error(await readMessage(res, 'Could not load appointments'));
      setAppointments((await res.json()) as Appointment[]);
      setLoadError('');
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Could not load appointments');
      setAppointments((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(refresh);
  }, [load]);

  async function act(id: string, action: 'accept' | 'decline' | 'cancel') {
    setBusyId(id);
    setActionError('');
    try {
      const res = await fetch(`/api/proxy/appointments/${id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error(await readMessage(res, 'That did not work'));
      await load();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusyId(null);
    }
  }

  if (appointments === null) return <p className="text-sm text-gray-500">Loading appointments…</p>;

  const upcoming = appointments
    .filter((a) => UPCOMING_STATUSES.includes(a.status))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const past = appointments
    .filter((a) => !UPCOMING_STATUSES.includes(a.status))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  function row(appointment: Appointment) {
    const style = STATUS_STYLES[appointment.status] ?? { label: appointment.status, className: 'bg-gray-100 text-gray-700' };
    const inFuture = new Date(appointment.scheduledAt).getTime() > Date.now();
    const who = mode === 'client' ? appointment.advisor.displayName : appointment.client.displayName;
    const needsAnswer = mode === 'advisor' && appointment.status === 'PENDING';
    const canCancel = appointment.status === 'ACCEPTED' || (appointment.status === 'PENDING' && mode === 'client');
    const busy = busyId === appointment.id;

    return (
      <li key={appointment.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-gray-900">{who}</p>
          <p className="text-sm text-gray-600">{formatWhen(appointment.scheduledAt)}</p>
          {mode === 'client' && (
            <p className="text-sm text-gray-500">${Number(appointment.advisor.ratePerMinute).toFixed(2)} per minute</p>
          )}
          {appointment.note && <p className="mt-1 text-sm text-gray-500">{appointment.note}</p>}
          {needsAnswer && !inFuture && <p className="mt-1 text-sm text-red-600">This time has passed.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}>
            {needsAnswer ? 'Needs your response' : style.label}
          </span>
          {needsAnswer && inFuture && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(appointment.id, 'accept')}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act(appointment.id, 'decline')}
                className="rounded-lg border px-4 py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Decline
              </button>
            </>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Cancel this appointment? The other person will be told.')) void act(appointment.id, 'cancel');
              }}
              className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {mode === 'client'
            ? 'Your requested and confirmed calls. We ring your phone at the scheduled time, so keep your wallet funded.'
            : 'Requests from clients. When you accept, we call you and then the client at the scheduled time.'}{' '}
          Times are shown in your local time.
        </p>
        <button type="button" onClick={() => void load()} className="shrink-0 rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50">
          Refresh
        </button>
      </div>

      {loadError && <p className="mb-3 text-sm text-red-600">{loadError}</p>}
      {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}

      <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Upcoming</h3>
      {upcoming.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">
          {mode === 'client' ? (
            <>
              No upcoming appointments.{' '}
              <a href="/phone-readings" className="font-medium underline">
                Schedule a call
              </a>
            </>
          ) : (
            'No upcoming appointments.'
          )}
        </p>
      ) : (
        <ul className="divide-y">{upcoming.map(row)}</ul>
      )}

      {past.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-gray-500">Past</h3>
          <ul className="divide-y">{past.map(row)}</ul>
        </>
      )}
    </div>
  );
}
