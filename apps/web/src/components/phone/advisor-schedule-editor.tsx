'use client';

import { useMemo, useState } from 'react';
import { readMessage, WEEK_ORDER, WEEKDAYS } from './phone-format';

export interface ScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone?: string;
}

interface Period {
  start: string;
  end: string;
}

const DEFAULT_PERIOD: Period = { start: '09:00', end: '17:00' };

function groupByDay(slots: ScheduleSlot[]): Record<number, Period[]> {
  const days: Record<number, Period[]> = {};
  for (const slot of slots) {
    (days[slot.dayOfWeek] ??= []).push({ start: slot.startTime, end: slot.endTime });
  }
  return days;
}

/** The advisor's usual weekly hours, shown on their public profile. */
export function AdvisorScheduleEditor({ initialSlots }: { initialSlots: ScheduleSlot[] }) {
  const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [timezone, setTimezone] = useState(initialSlots[0]?.timezone ?? detectedZone);
  const [days, setDays] = useState<Record<number, Period[]>>(() => groupByDay(initialSlots));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const zones = useMemo(() => {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const all = supported ? supported('timeZone') : [];
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  function update(day: number, change: (periods: Period[]) => Period[]) {
    setMessage('');
    setDays((current) => ({ ...current, [day]: change(current[day] ?? []) }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const slots = WEEK_ORDER.flatMap((day) =>
        (days[day] ?? []).map((period) => ({ dayOfWeek: day, startTime: period.start, endTime: period.end })),
      );
      const res = await fetch('/api/proxy/account/advisor-profile/schedule', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timezone, slots }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not save your schedule'));
      setMessage('Schedule saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save your schedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h3 className="font-semibold text-gray-950">Weekly schedule</h3>
      <p className="mt-1 text-sm text-gray-600">
        The hours you usually take calls, shown on your public profile so clients know when to reach you. Clients can still request
        an appointment at any time and you choose whether to accept.
      </p>

      <label className="mt-4 block text-sm font-medium text-gray-700">
        Time zone
        {zones.length > 1 ? (
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm"
          />
        )}
      </label>

      <ul className="mt-4 divide-y rounded-lg border border-gray-200">
        {WEEK_ORDER.map((day) => {
          const periods = days[day] ?? [];
          return (
            <li key={day} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-2 text-sm font-medium text-gray-900">{WEEKDAYS[day]}</span>
              <div className="flex-1 space-y-2">
                {periods.length === 0 && <p className="pt-2 text-sm text-gray-400">Not available</p>}
                {periods.map((period, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={period.start}
                      onChange={(event) =>
                        update(day, (list) => list.map((item, i) => (i === index ? { ...item, start: event.target.value } : item)))
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      aria-label={`${WEEKDAYS[day]} start time`}
                    />
                    <span className="text-sm text-gray-500">to</span>
                    <input
                      type="time"
                      value={period.end}
                      onChange={(event) =>
                        update(day, (list) => list.map((item, i) => (i === index ? { ...item, end: event.target.value } : item)))
                      }
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      aria-label={`${WEEKDAYS[day]} end time`}
                    />
                    <button
                      type="button"
                      onClick={() => update(day, (list) => list.filter((_, i) => i !== index))}
                      className="rounded-lg border px-2.5 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                      aria-label={`Remove this period on ${WEEKDAYS[day]}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update(day, (list) => [...list, { ...DEFAULT_PERIOD }])}
                  className="text-sm font-medium text-purple-700 hover:underline"
                >
                  + Add hours
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-4 rounded-lg bg-purple-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Schedule'}
      </button>
    </div>
  );
}
