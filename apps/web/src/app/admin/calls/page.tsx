'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Tab = 'log' | 'live' | 'revenue';
type Preset = 'today' | '7d' | '30d' | 'month' | 'custom';

interface CallView {
  id: string;
  startedAt: string;
  connectedAt: string | null;
  endedAt: string | null;
  status: string;
  statusLabel: string;
  live: boolean;
  source: string;
  sourceLabel: string;
  advisor: { id: string; displayName: string };
  client: { id: string; username: string | null; email: string };
  talkSeconds: number;
  billedMinutes: number;
  billedAmountCents: number;
}

interface LogResponse {
  page: number;
  pageSize: number;
  total: number;
  totals: { calls: number; connected: number; billedMinutes: number; billedAmountCents: number; talkSeconds: number };
  calls: CallView[];
}

interface LiveResponse {
  calls: Array<CallView & { elapsedSeconds: number; talkingSeconds: number }>;
  advisors: Array<{
    id: string;
    displayName: string;
    status: 'ON_CALL' | 'ONLINE' | 'OFFLINE';
    acceptsLine: boolean;
    waitingInLine: number;
    upcomingAppointments: number;
    appointmentRequests: number;
  }>;
}

interface RevenueResponse {
  timeZone: string;
  truncated: boolean;
  totals: { calls: number; connected: number; billedMinutes: number; billedAmountCents: number; talkSeconds: number };
  advisors: Array<{ advisorId: string; displayName: string; calls: number; connected: number; billedMinutes: number; billedAmountCents: number; talkSeconds: number }>;
  days: Array<{ day: string; calls: number; billedAmountCents: number }>;
}

interface AdvisorOption {
  id: string;
  displayName: string;
}

const LIVE_REFRESH_MS = 10_000;

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function duration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** A date input's value (yyyy-mm-dd) for a Date, in the admin's own time zone. */
function dateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function rangeFor(preset: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  if (preset === '7d') start.setDate(start.getDate() - 6);
  if (preset === '30d') start.setDate(start.getDate() - 29);
  if (preset === 'month') start.setDate(1);
  return { from: dateInput(start), to: dateInput(today) };
}

const clientName = (call: CallView) => call.client.username ?? call.client.email;

export default function AdminCallsPage() {
  const [tab, setTab] = useState<Tab>('log');
  const [preset, setPreset] = useState<Preset>('7d');
  const [range, setRange] = useState(() => rangeFor('7d'));
  const [advisorId, setAdvisorId] = useState('');
  const [outcome, setOutcome] = useState('all');
  const [source, setSource] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [advisors, setAdvisors] = useState<AdvisorOption[]>([]);

  const [log, setLog] = useState<LogResponse | null>(null);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', new Date(`${range.from}T00:00:00`).toISOString());
    if (range.to) params.set('to', new Date(`${range.to}T23:59:59.999`).toISOString());
    if (advisorId) params.set('advisorId', advisorId);
    if (outcome !== 'all') params.set('outcome', outcome);
    if (source !== 'all') params.set('source', source);
    if (search) params.set('search', search);
    return params;
  }, [range, advisorId, outcome, source, search]);

  useEffect(() => {
    fetch('/api/proxy/advisors')
      .then((res) => (res.ok ? (res.json() as Promise<AdvisorOption[]>) : []))
      .then((rows) => setAdvisors(rows.map((row) => ({ id: row.id, displayName: row.displayName }))))
      .catch(() => setAdvisors([]));
  }, []);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(filterQuery);
      params.set('page', String(page));
      const res = await fetch(`/api/proxy/admin/calls?${params.toString()}`);
      if (!res.ok) throw new Error(await readMessage(res, `Could not load the call log (HTTP ${res.status}).`));
      setLog((await res.json()) as LogResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the call log.');
    } finally {
      setLoading(false);
    }
  }, [filterQuery, page]);

  const loadLive = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/calls/live');
      if (!res.ok) throw new Error(await readMessage(res, `Could not load live calls (HTTP ${res.status}).`));
      setLive((await res.json()) as LiveResponse);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load live calls.');
    }
  }, []);

  const loadRevenue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(filterQuery);
      params.delete('outcome');
      params.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      const res = await fetch(`/api/proxy/admin/calls/revenue?${params.toString()}`);
      if (!res.ok) throw new Error(await readMessage(res, `Could not load revenue (HTTP ${res.status}).`));
      setRevenue((await res.json()) as RevenueResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load revenue.');
    } finally {
      setLoading(false);
    }
  }, [filterQuery]);

  useEffect(() => {
    if (tab === 'log') void loadLog();
  }, [tab, loadLog]);

  useEffect(() => {
    if (tab !== 'revenue') return;
    void loadRevenue();
  }, [tab, loadRevenue]);

  useEffect(() => {
    if (tab !== 'live') return;
    void loadLive();
    const refresh = setInterval(() => void loadLive(), LIVE_REFRESH_MS);
    return () => clearInterval(refresh);
  }, [tab, loadLive]);

  function applyPreset(next: Preset) {
    setPreset(next);
    setPage(1);
    if (next !== 'custom') setRange(rangeFor(next));
  }

  function changeFilter(change: () => void) {
    change();
    setPage(1);
  }

  async function endCall(call: CallView) {
    if (!window.confirm(`End the call between ${call.advisor.displayName} and ${clientName(call)} now? Billing stops and both phones are hung up.`)) return;
    setBusyId(call.id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/calls/${call.id}/end`, { method: 'POST' });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not end the call.'));
      setMessage('The call was ended.');
      await loadLive();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end the call.');
    } finally {
      setBusyId(null);
    }
  }

  async function downloadCsv() {
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/calls/export?${filterQuery.toString()}`);
      if (!res.ok) throw new Error(await readMessage(res, 'Could not export the call log.'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calls-${range.from || 'all'}-to-${range.to || 'now'}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage('The call log was downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the call log.');
    }
  }

  const pages = log ? Math.max(1, Math.ceil(log.total / log.pageSize)) : 1;

  const filters = (
    <form
      className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        changeFilter(() => setSearch(searchInput.trim()));
      }}
    >
      <label className="text-sm font-medium text-gray-700">
        Period
        <select value={preset} onChange={(event) => applyPreset(event.target.value as Preset)} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="month">This month</option>
          <option value="custom">Custom dates</option>
        </select>
      </label>
      {preset === 'custom' && (
        <>
          <label className="text-sm font-medium text-gray-700">
            From
            <input type="date" value={range.from} onChange={(event) => changeFilter(() => setRange((r) => ({ ...r, from: event.target.value })))} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-gray-700">
            To
            <input type="date" value={range.to} onChange={(event) => changeFilter(() => setRange((r) => ({ ...r, to: event.target.value })))} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </>
      )}
      <label className="text-sm font-medium text-gray-700">
        Advisor
        <select value={advisorId} onChange={(event) => changeFilter(() => setAdvisorId(event.target.value))} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">All advisors</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-gray-700">
        How it started
        <select value={source} onChange={(event) => changeFilter(() => setSource(event.target.value))} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="DIRECT">Call Now</option>
          <option value="APPOINTMENT">Appointment</option>
          <option value="QUEUE">Callback line</option>
          <option value="HOTLINE">Hotline</option>
        </select>
      </label>
      {tab === 'log' && (
        <label className="text-sm font-medium text-gray-700">
          Outcome
          <select value={outcome} onChange={(event) => changeFilter(() => setOutcome(event.target.value))} className="mt-1 block rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="all">All calls</option>
            <option value="connected">Connected</option>
            <option value="problem">Problems (did not connect, out of funds)</option>
            <option value="live">In progress</option>
          </select>
        </label>
      )}
      <label className="min-w-[12rem] flex-1 text-sm font-medium text-gray-700">
        Search
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Client username, email or advisor" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        Apply
      </button>
    </form>
  );

  const stat = (label: string, value: string) => (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-950">{value}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-950">Calls</h1>
          <p className="mt-2 text-sm text-gray-600">
            Every phone call: how it started, how it ended, and what was billed. Clients are shown by username with their email beside it.
          </p>
        </header>

        <nav className="flex gap-2 border-b border-gray-200">
          {(
            [
              ['log', 'Call log'],
              ['live', 'Live now'],
              ['revenue', 'Revenue'],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setError('');
                setMessage('');
              }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {/* ── Call log ─────────────────────────────────────────────────────── */}
        {tab === 'log' && (
          <section className="space-y-4">
            {filters}

            {log && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {stat('Calls', String(log.totals.calls))}
                {stat('Connected', String(log.totals.connected))}
                {stat('Talk time', duration(log.totals.talkSeconds))}
                {stat('Minutes billed', String(log.totals.billedMinutes))}
                {stat('Billed', money(log.totals.billedAmountCents))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-gray-500">{log ? `${log.total} call${log.total === 1 ? '' : 's'} match` : ''}</p>
              <button type="button" onClick={() => void downloadCsv()} className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
                Download CSV
              </button>
            </div>

            {loading && !log ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : log && log.calls.length === 0 ? (
              <p className="text-sm text-gray-500">No calls match.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Started</th>
                      <th className="px-4 py-3">Advisor</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">How</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-4 py-3 text-right">Talk time</th>
                      <th className="px-4 py-3 text-right">Billed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {log?.calls.map((call) => (
                      <tr key={call.id} className={call.status === 'ENDED_NOT_CONNECTED' || call.status === 'ENDED_LOW_BALANCE' ? 'bg-amber-50/50' : ''}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{new Date(call.startedAt).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-gray-950">{call.advisor.displayName}</td>
                        <td className="px-4 py-3">
                          <div className="text-gray-950">{call.client.username ?? 'no username'}</div>
                          <div className="text-xs text-gray-500">{call.client.email}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{call.sourceLabel}</td>
                        <td className="px-4 py-3 text-gray-700">{call.statusLabel}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{call.connectedAt ? duration(call.talkSeconds) : '-'}</td>
                        <td className="px-4 py-3 text-right text-gray-950">
                          {money(call.billedAmountCents)}
                          <div className="text-xs text-gray-500">{call.billedMinutes} min</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {log && pages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40">
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {log.page} of {pages}
                </span>
                <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40">
                  Next
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Live ─────────────────────────────────────────────────────────── */}
        {tab === 'live' && (
          <section className="space-y-6">
            <p className="text-sm text-gray-500">Refreshes every 10 seconds.</p>

            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-950">Calls in progress</h2>
              {!live ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : live.calls.length === 0 ? (
                <p className="text-sm text-gray-500">No calls right now.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                  <table className="w-full min-w-[44rem] text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Advisor</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">How</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3 text-right">Talking</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {live.calls.map((call) => (
                        <tr key={call.id}>
                          <td className="px-4 py-3 font-medium text-gray-950">{call.advisor.displayName}</td>
                          <td className="px-4 py-3">
                            <div className="text-gray-950">{call.client.username ?? 'no username'}</div>
                            <div className="text-xs text-gray-500">{call.client.email}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{call.sourceLabel}</td>
                          <td className="px-4 py-3 text-gray-700">{call.statusLabel}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{call.connectedAt ? duration(call.talkingSeconds) : `setting up ${duration(call.elapsedSeconds)}`}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={busyId === call.id}
                              onClick={() => void endCall(call)}
                              className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              End call
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-950">Advisors</h2>
              {live && live.advisors.length === 0 ? (
                <p className="text-sm text-gray-500">No advisors have a phone number set yet.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                  <table className="w-full min-w-[40rem] text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Advisor</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Waiting in line</th>
                        <th className="px-4 py-3 text-right">Booked appointments</th>
                        <th className="px-4 py-3 text-right">Requests to answer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {live?.advisors.map((advisor) => (
                        <tr key={advisor.id}>
                          <td className="px-4 py-3 font-medium text-gray-950">{advisor.displayName}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                advisor.status === 'ON_CALL' ? 'bg-amber-50 text-amber-800' : advisor.status === 'ONLINE' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {advisor.status === 'ON_CALL' ? 'On a call' : advisor.status === 'ONLINE' ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{advisor.waitingInLine}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{advisor.upcomingAppointments}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{advisor.appointmentRequests}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Revenue ──────────────────────────────────────────────────────── */}
        {tab === 'revenue' && (
          <section className="space-y-4">
            {filters}

            {loading && !revenue ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : revenue ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {stat('Billed', money(revenue.totals.billedAmountCents))}
                  {stat('Minutes billed', String(revenue.totals.billedMinutes))}
                  {stat('Calls', String(revenue.totals.calls))}
                  {stat('Connected', String(revenue.totals.connected))}
                  {stat('Talk time', duration(revenue.totals.talkSeconds))}
                </div>
                {revenue.truncated && <p className="text-xs text-amber-700">There are more calls than can be added up at once. Narrow the period for exact totals.</p>}

                <div>
                  <h2 className="mb-2 text-lg font-semibold text-gray-950">By advisor</h2>
                  {revenue.advisors.length === 0 ? (
                    <p className="text-sm text-gray-500">No finished calls in this period.</p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                      <table className="w-full min-w-[40rem] text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="px-4 py-3">Advisor</th>
                            <th className="px-4 py-3 text-right">Calls</th>
                            <th className="px-4 py-3 text-right">Connected</th>
                            <th className="px-4 py-3 text-right">Talk time</th>
                            <th className="px-4 py-3 text-right">Minutes</th>
                            <th className="px-4 py-3 text-right">Billed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {revenue.advisors.map((advisor) => (
                            <tr key={advisor.advisorId}>
                              <td className="px-4 py-3 font-medium text-gray-950">{advisor.displayName}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{advisor.calls}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{advisor.connected}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{duration(advisor.talkSeconds)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{advisor.billedMinutes}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-950">{money(advisor.billedAmountCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="mb-2 text-lg font-semibold text-gray-950">By day</h2>
                  <p className="mb-2 text-xs text-gray-500">Days are in your time zone ({revenue.timeZone}).</p>
                  {revenue.days.length === 0 ? (
                    <p className="text-sm text-gray-500">Nothing billed in this period.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
                      {revenue.days.map((day) => {
                        const max = Math.max(...revenue.days.map((d) => d.billedAmountCents), 1);
                        return (
                          <li key={day.day} className="flex items-center gap-4 px-4 py-2 text-sm">
                            <span className="w-28 shrink-0 text-gray-700">{day.day}</span>
                            <span className="h-3 flex-1 rounded bg-gray-100">
                              <span className="block h-3 rounded bg-indigo-500" style={{ width: `${Math.round((day.billedAmountCents / max) * 100)}%` }} />
                            </span>
                            <span className="w-16 shrink-0 text-right text-gray-500">{day.calls} call{day.calls === 1 ? '' : 's'}</span>
                            <span className="w-20 shrink-0 text-right font-medium text-gray-950">{money(day.billedAmountCents)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}
