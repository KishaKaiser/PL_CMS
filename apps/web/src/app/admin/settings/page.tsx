'use client';

import { useState, useEffect, useCallback } from 'react';

interface Setting {
  key: string;
  value: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proxy/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json() as Setting[];
      setSettings(data);
      const vals: Record<string, string> = {};
      data.forEach((s) => { vals[s.key] = s.value; });
      setEditValues(vals);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchSettings(); }, [fetchSettings]);

  async function handleSave(key: string) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const res = await fetch(`/api/proxy/settings/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValues[key] }),
      });
      if (!res.ok) throw new Error('Save failed');
      const updated = await res.json() as Setting;
      setSettings((ss) => ss.map((s) => (s.key === key ? updated : s)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving setting');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/proxy/settings/${encodeURIComponent(newKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) throw new Error('Add failed');
      const added = await res.json() as Setting;
      setSettings((ss) => [...ss.filter((s) => s.key !== added.key), added].sort((a, b) => a.key.localeCompare(b.key)));
      setEditValues((v) => ({ ...v, [added.key]: added.value }));
      setNewKey('');
      setNewValue('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="mb-6 text-3xl font-bold">Settings</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Add Setting</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input required value={newKey} onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key" className="flex-1 rounded border px-3 py-2 text-sm font-mono" />
          <input required value={newValue} onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value" className="flex-1 rounded border px-3 py-2 text-sm" />
          <button type="submit" disabled={adding}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All Settings</h2>
        {loading ? <p className="text-gray-500">Loading…</p> : settings.length === 0 ? (
          <p className="text-gray-500">No settings yet.</p>
        ) : (
          <div className="space-y-2">
            {settings.map((setting) => (
              <div key={setting.key} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
                <span className="w-48 shrink-0 font-mono text-sm font-medium text-gray-700">{setting.key}</span>
                <input
                  value={editValues[setting.key] ?? setting.value}
                  onChange={(e) => setEditValues((v) => ({ ...v, [setting.key]: e.target.value }))}
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleSave(setting.key)}
                  disabled={saving[setting.key]}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving[setting.key] ? 'Saving…' : 'Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
