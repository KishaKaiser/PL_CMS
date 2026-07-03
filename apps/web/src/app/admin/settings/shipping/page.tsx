'use client';

import { useEffect, useState } from 'react';

interface WarehouseAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const emptyForm: WarehouseAddress = {
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

export default function ShippingSettingsPage() {
  const [form, setForm] = useState<WarehouseAddress>(emptyForm);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/shipping/warehouse-address'),
      fetch('/api/proxy/shipping/diagnostics'),
    ])
      .then(async ([addressRes, diagnosticsRes]) => {
        if (addressRes.ok) {
          const data = (await addressRes.json()) as WarehouseAddress | null;
          if (data) setForm({ ...emptyForm, ...data });
        }
        if (diagnosticsRes.ok) setDiagnostics((await diagnosticsRes.json()) as Record<string, unknown>);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/proxy/shipping/warehouse-address', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Failed to save warehouse address');
      }
      setSuccess('Warehouse address saved successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="p-8"><p className="text-gray-500">Loading…</p></main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Shipping Settings</h1>
      <p className="mb-6 text-gray-500 text-sm">
        Configure the warehouse origin address used for ShipStation live rate quotes.
        This address will be the &quot;Ship From&quot; location for all shipments.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Warehouse Origin Address</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Contact / Company Name *</label>
            <input required value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone *</label>
            <input required value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Address Line 1 *</label>
            <input required value={form.line1}
              onChange={(e) => setForm({ ...form, line1: e.target.value })}
              placeholder="Street address"
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700">Address Line 2</label>
            <input value={form.line2 ?? ''}
              onChange={(e) => setForm({ ...form, line2: e.target.value })}
              placeholder="Suite, unit, etc."
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">City *</label>
            <input required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">State (2-letter) *</label>
            <input required value={form.state} maxLength={2}
              onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
              placeholder="e.g. TX"
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">ZIP Code *</label>
            <input required value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              placeholder="e.g. 78701"
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Country *</label>
            <select value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="US">United States</option>
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={saving}
              className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Warehouse Address'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          <strong>ShipStation API credentials</strong> are saved under{' '}
          <a href="/admin/settings" className="text-indigo-600 hover:underline">Admin Settings → API settings → Shipping</a>.
          Environment variables are only used as a fallback.
        </p>
      </div>

      {diagnostics && (
        <section className="mt-6 rounded-lg border bg-white p-5 text-sm shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">ShipStation Diagnostics</h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(diagnostics).map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{key}</dt>
                <dd className="mt-1 break-words text-gray-800">{Array.isArray(value) ? value.join(', ') : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-6">
        <a href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Back to Admin
        </a>
      </div>
    </main>
  );
}
