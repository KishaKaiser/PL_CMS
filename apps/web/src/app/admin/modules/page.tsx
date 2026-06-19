'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface InstalledModule {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const starterConfig = '{\n  "description": ""\n}';

export default function AdminModulesPage() {
  const [modules, setModules] = useState<InstalledModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [enabled, setEnabled] = useState(true);
  const [configText, setConfigText] = useState(starterConfig);

  const enabledCount = useMemo(
    () => modules.filter((module) => module.enabled).length,
    [modules],
  );

  const fetchModules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/modules');
      if (!res.ok) throw new Error('Failed to load modules');
      setModules((await res.json()) as InstalledModule[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchModules();
  }, [fetchModules]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configText) as Record<string, unknown>;
      if (Array.isArray(config) || config === null || typeof config !== 'object') {
        throw new Error('Config must be a JSON object');
      }
    } catch (err: unknown) {
      setSaving(false);
      setError(err instanceof Error ? err.message : 'Config must be valid JSON');
      return;
    }

    try {
      const res = await fetch('/api/proxy/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, version, enabled, config }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Module could not be added');
      }
      const created = (await res.json()) as InstalledModule;
      setModules((current) => [created, ...current].sort(sortModules));
      setName('');
      setVersion('1.0.0');
      setEnabled(true);
      setConfigText(starterConfig);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error adding module');
    } finally {
      setSaving(false);
    }
  }

  async function updateModule(id: string, body: Partial<InstalledModule>) {
    setError('');
    try {
      const res = await fetch(`/api/proxy/modules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Module update failed');
      const updated = (await res.json()) as InstalledModule;
      setModules((current) =>
        current.map((module) => (module.id === id ? updated : module)).sort(sortModules),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating module');
    }
  }

  async function removeModule(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/proxy/modules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Module removal failed');
      setModules((current) => current.filter((module) => module.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error removing module');
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Modules</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage built-in platform features such as billing, checkout, and fulfillment.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Installed</div>
            <div className="mt-1 text-2xl font-semibold">{modules.length}</div>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Enabled</div>
            <div className="mt-1 text-2xl font-semibold">{enabledCount}</div>
          </div>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Add module</h2>
        <form onSubmit={handleAdd} className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div>
            <label className="block text-sm font-medium text-gray-700">Module name</label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="custom-module"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Version</label>
            <input
              required
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Enable after adding
          </label>
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Config JSON</label>
            <textarea
              value={configText}
              onChange={(event) => setConfigText(event.target.value)}
              rows={5}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add module'}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : modules.length === 0 ? (
        <p className="text-gray-500">No modules installed.</p>
      ) : (
        <div className="overflow-auto rounded-lg border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Version', 'Status', 'Updated', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{module.name}</div>
                    <div className="mt-1 max-w-md truncate font-mono text-xs text-gray-500">
                      {JSON.stringify(module.config)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{module.version}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        module.enabled
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {module.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(module.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void updateModule(module.id, { enabled: !module.enabled })}
                        className="rounded border border-gray-200 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        {module.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeModule(module.id)}
                        className="rounded border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
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

function sortModules(a: InstalledModule, b: InstalledModule) {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  return a.name.localeCompare(b.name);
}
