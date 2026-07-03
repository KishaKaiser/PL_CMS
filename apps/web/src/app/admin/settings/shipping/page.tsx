'use client';

import { useEffect, useState } from 'react';

interface WarehouseAddress {
  warehouseId?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface TestQuoteResult {
  success: boolean;
  message?: string;
  rates?: Array<{
    serviceName: string;
    serviceCode: string;
    carrierCode: string;
    shipmentCost: number;
    otherCost: number;
  }>;
  attempts?: Array<{
    carrierCode: string;
    requestBody: Record<string, unknown>;
    status?: number;
    rateCount?: number;
    services?: Array<{
      serviceName: string;
      serviceCode: string;
      carrierCode: string;
      shipmentCost: number;
      otherCost: number;
    }>;
    error?: string;
  }>;
}

const emptyForm: WarehouseAddress = {
  warehouseId: '',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
};

const defaultTestAddress = {
  fullName: 'Test Customer',
  phone: '5555555555',
  line1: '1600 Pennsylvania Ave NW',
  line2: '',
  city: 'Washington',
  state: 'DC',
  postalCode: '20500',
  country: 'US',
  email: 'test@example.com',
};

export default function ShippingSettingsPage() {
  const [form, setForm] = useState<WarehouseAddress>(emptyForm);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [testAddress, setTestAddress] = useState(defaultTestAddress);
  const [testPackage, setTestPackage] = useState({ weightOz: 16, lengthIn: 10, widthIn: 10, heightIn: 10 });
  const [testResult, setTestResult] = useState<TestQuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
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

  async function runTestQuote() {
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      const res = await fetch('/api/proxy/shipping/diagnostics/test-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: testAddress,
          weightOz: Number(testPackage.weightOz),
          lengthIn: Number(testPackage.lengthIn),
          widthIn: Number(testPackage.widthIn),
          heightIn: Number(testPackage.heightIn),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TestQuoteResult & { message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Test quote failed.');
      setTestResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Test quote failed.');
    } finally {
      setTesting(false);
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
            <label className="block text-sm font-medium text-gray-700">ShipStation Warehouse ID</label>
            <input value={form.warehouseId ?? ''}
              onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              placeholder="Optional facility / warehouse ID from ShipStation"
              className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-gray-500">
              Optional. Use this if your ShipStation carriers are tied to a specific warehouse or facility.
            </p>
          </div>
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

      <section className="mt-6 rounded-lg border bg-white p-5 text-sm shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Test Live ShipStation Quote</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">City
            <input value={testAddress.city} onChange={(event) => setTestAddress((current) => ({ ...current, city: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">State
            <input value={testAddress.state} maxLength={2} onChange={(event) => setTestAddress((current) => ({ ...current, state: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">ZIP Code
            <input value={testAddress.postalCode} onChange={(event) => setTestAddress((current) => ({ ...current, postalCode: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Country
            <input value={testAddress.country} onChange={(event) => setTestAddress((current) => ({ ...current, country: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">Weight (oz)
            <input type="number" min="1" value={testPackage.weightOz} onChange={(event) => setTestPackage((current) => ({ ...current, weightOz: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block text-sm font-medium text-gray-700">L
              <input type="number" min="1" value={testPackage.lengthIn} onChange={(event) => setTestPackage((current) => ({ ...current, lengthIn: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">W
              <input type="number" min="1" value={testPackage.widthIn} onChange={(event) => setTestPackage((current) => ({ ...current, widthIn: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">H
              <input type="number" min="1" value={testPackage.heightIn} onChange={(event) => setTestPackage((current) => ({ ...current, heightIn: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
            </label>
          </div>
        </div>
        <button type="button" onClick={() => void runTestQuote()} disabled={testing} className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {testing ? 'Testing...' : 'Run Test Quote'}
        </button>
        {testResult && (
          <div className="mt-4 rounded border bg-gray-50 p-4">
            <p className={testResult.success ? 'font-medium text-green-700' : 'font-medium text-red-700'}>
              {testResult.success ? `Returned ${testResult.rates?.length ?? 0} rate(s).` : testResult.message}
            </p>
            {testResult.rates && testResult.rates.length > 0 && (
              <ul className="mt-3 space-y-1">
                {testResult.rates.map((rate) => (
                  <li key={`${rate.carrierCode}-${rate.serviceCode}`} className="rounded bg-white px-3 py-2">
                    {rate.serviceName}: ${(Number(rate.shipmentCost) + Number(rate.otherCost)).toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
            {testResult.attempts && testResult.attempts.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-gray-700">Carrier attempts</summary>
                <pre className="mt-2 max-h-80 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(testResult.attempts, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </section>

      <div className="mt-6">
        <a href="/admin" className="text-sm text-indigo-600 hover:underline">
          ← Back to Admin
        </a>
      </div>
    </main>
  );
}
