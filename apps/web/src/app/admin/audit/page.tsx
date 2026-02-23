'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/audit');
      if (!res.ok) throw new Error('Failed to load audit log');
      setLogs(await res.json() as AuditLog[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Audit Log</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading ? <p className="text-gray-500">Loading…</p> : logs.length === 0 ? (
        <p className="text-gray-500">No audit log entries.</p>
      ) : (
        <div className="overflow-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Actor', 'Action', 'Entity', 'Entity ID', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.entityId ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
