'use client';

import { useCallback, useEffect, useState } from 'react';

interface AdvisorRow {
  id: string;
  displayName: string;
  ratePerMinute: string | number;
  isOnline: boolean;
  sipExtension: string | null;
  queueCallingEnabled: boolean;
  user: { id: string; name: string; email: string };
}

export default function AdminAdvisorsPage() {
  const [advisors, setAdvisors] = useState<AdvisorRow[]>([]);
  const [extensionDrafts, setExtensionDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchAdvisors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/advisors');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `Could not load advisors (HTTP ${res.status}).`);
      }
      setAdvisors((await res.json()) as AdvisorRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load advisors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdvisors();
  }, [fetchAdvisors]);

  async function saveExtension(id: string) {
    setSavingId(id);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/advisors/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sipExtension: extensionDrafts[id] ?? '' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Could not save extension.');
      }
      setMessage('Extension saved.');
      await fetchAdvisors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save extension.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-950">Advisors</h1>
          <p className="mt-2 text-sm text-gray-600">
            Assign each advisor&apos;s internal SIP extension on the Grandstream UCM6301 so calls can be bridged through the Twilio trunk.
          </p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : advisors.length === 0 ? (
          <p className="text-sm text-gray-500">No advisor accounts yet.</p>
        ) : (
          <div className="overflow-hidden rounded border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Advisor</th>
                  <th className="px-4 py-3">Rate/min</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Extension</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {advisors.map((advisor) => (
                  <tr key={advisor.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-950">{advisor.displayName}</div>
                      <div className="text-xs text-gray-500">{advisor.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">${Number(advisor.ratePerMinute).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${advisor.isOnline ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {advisor.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={extensionDrafts[advisor.id] ?? advisor.sipExtension ?? ''}
                        onChange={(event) => setExtensionDrafts((current) => ({ ...current, [advisor.id]: event.target.value }))}
                        placeholder="e.g. 1001"
                        className="w-28 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void saveExtension(advisor.id)}
                        disabled={savingId === advisor.id}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingId === advisor.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
