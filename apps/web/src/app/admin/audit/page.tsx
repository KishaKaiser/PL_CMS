'use client';

import { useCallback, useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

const ENTITY_OPTIONS = [
  '',
  'POST',
  'PAGE',
  'MEDIA_ASSET',
  'USER',
  'SETTING',
  'MODULE',
  'PRODUCT',
  'ORDER',
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = useCallback(
    async (nextFilters?: { entity?: string; from?: string; to?: string }) => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        const currentEntity = nextFilters?.entity ?? entity;
        const currentFrom = nextFilters?.from ?? from;
        const currentTo = nextFilters?.to ?? to;
        if (currentEntity) params.set('entity', currentEntity);
        if (currentFrom) params.set('from', currentFrom);
        if (currentTo) params.set('to', currentTo);

        const query = params.toString();
        const res = await fetch(`/api/proxy/audit${query ? `?${query}` : ''}`);
        if (!res.ok) throw new Error('Failed to load audit log');
        setLogs((await res.json()) as AuditLog[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    },
    [entity, from, to],
  );

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-600">
            Filter activity by entity type and date range.
          </p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Entity</label>
            <select
              value={entity}
              onChange={(event) => setEntity(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">All entities</option>
              {ENTITY_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => void fetchLogs()}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                setEntity('');
                setFrom('');
                setTo('');
                void fetchLogs({ entity: '', from: '', to: '' });
              }}
              className="rounded border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500">No audit log entries.</p>
      ) : (
        <div className="overflow-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Actor', 'Action', 'Entity', 'Entity ID', 'Date'].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{log.actor.name}</div>
                    <div className="text-xs text-gray-500">{log.actor.email}</div>
                  </td>
                  <td className="px-4 py-3 font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{log.entity}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {log.entityId ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
