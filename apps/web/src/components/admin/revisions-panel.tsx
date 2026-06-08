'use client';

import { useCallback, useEffect, useState } from 'react';

interface Revision {
  id: string;
  title: string;
  isAutosave: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface RevisionsPanelProps {
  endpointBase: string;
  open: boolean;
  refreshKey?: number;
  onRestored?: () => Promise<void> | void;
}

export function RevisionsPanel({
  endpointBase,
  open,
  refreshKey = 0,
  onRestored,
}: RevisionsPanelProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadRevisions = useCallback(async () => {
    if (!open || !endpointBase) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${endpointBase}/revisions`);
      if (!res.ok) throw new Error('Failed to load revisions');
      setRevisions((await res.json()) as Revision[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load revisions');
    } finally {
      setLoading(false);
    }
  }, [endpointBase, open]);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions, refreshKey]);

  async function handleRestore(revisionId: string) {
    if (!confirm('Restore this revision? Current unsaved changes will be replaced.')) return;

    setRestoringId(revisionId);
    setError('');
    try {
      const res = await fetch(`${endpointBase}/revisions/${revisionId}/restore`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Failed to restore revision');
      }
      await onRestored?.();
      await loadRevisions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to restore revision');
    } finally {
      setRestoringId(null);
    }
  }

  if (!open) return null;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Revisions</h3>
          <p className="mt-1 text-xs text-gray-500">
            Restore the latest autosave or a previous revision snapshot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRevisions()}
          className="rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading revisions…</p>
      ) : revisions.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No revisions available yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {revisions.map((revision) => (
            <div key={revision.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {revision.title || 'Untitled revision'}
                    </p>
                    {revision.isAutosave && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Autosave
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(revision.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {revision.createdBy.name || revision.createdBy.email} ·{' '}
                    {revision.createdBy.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRestore(revision.id)}
                  disabled={restoringId === revision.id}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {restoringId === revision.id ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
