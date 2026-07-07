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

interface CustomStoreConnection {
  endpointUrl: string;
  usernameConfigured: boolean;
  passwordConfigured: boolean;
  authentication: string;
}

interface Setting {
  key: string;
  value: string;
}

interface ShippingApiForm {
  provider: 'manual' | 'shipstation' | 'shippo' | 'easypost';
  apiKey: string;
  apiSecret: string;
  accountId: string;
  originPostalCode: string;
  originCountry: string;
  enabledCarrierCodes: string[];
  allowedServiceCodes: string[];
  markupType: 'fixed' | 'percentage';
  markupAmount: string;
}

const SHIPPING_API_SETTINGS_KEY = 'shipping_api_settings';

const defaultShippingApiForm: ShippingApiForm = {
  provider: 'manual',
  apiKey: '',
  apiSecret: '',
  accountId: '',
  originPostalCode: '',
  originCountry: 'US',
  enabledCarrierCodes: ['usps'],
  allowedServiceCodes: [],
  markupType: 'fixed',
  markupAmount: '0',
};

const shipStationServiceOptions = [
  ['usps_first_class_mail', 'USPS - First Class Mail'],
  ['usps_ground_advantage', 'USPS - Ground Advantage'],
  ['usps_parcel_select_ground', 'USPS - Parcel Select Ground Package'],
  ['usps_priority_mail', 'USPS - Priority Mail (All)'],
  ['usps_priority_mail_package_only', 'USPS - Priority Mail Package'],
  ['usps_priority_mail_flat_rate_only', 'USPS - Priority Mail Flat Rate Only'],
  ['usps_priority_mail_express', 'USPS - Priority Mail Express'],
  ['ups_ground', 'UPS - Ground'],
  ['ups_ground_saver', 'UPS - Ground Saver'],
  ['ups_2nd_day_air', 'UPS - 2nd Day Air'],
  ['ups_next_day_air', 'UPS - Next Day Air'],
  ['ups_3_day_select', 'UPS - 3 Day Select'],
] as const;

const preferredCheckoutServiceCodes = [
  'usps_priority_mail_package_only',
  'usps_parcel_select_ground',
  'ups_ground',
  'ups_2nd_day_air',
];

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
  addressType: 'residential',
  city: 'Washington',
  state: 'DC',
  postalCode: '20500',
  country: 'US',
  email: 'test@example.com',
};

function parseJsonValue<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readStringOrNumber(value: unknown, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function readOption<T extends string>(value: unknown, options: readonly T[], fallback: T) {
  return typeof value === 'string' && options.includes(value as T) ? (value as T) : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const strings = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item === 'stamps_com' ? 'usps' : item === 'globalpost' ? 'global_post' : item);
  return strings.length > 0 ? strings : fallback;
}

export default function ShippingSettingsPage() {
  const [form, setForm] = useState<WarehouseAddress>(emptyForm);
  const [shippingApiForm, setShippingApiForm] = useState<ShippingApiForm>(defaultShippingApiForm);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [customStore, setCustomStore] = useState<CustomStoreConnection | null>(null);
  const [customStoreForm, setCustomStoreForm] = useState({ username: '', password: '' });
  const [testAddress, setTestAddress] = useState(defaultTestAddress);
  const [testPackage, setTestPackage] = useState({ weightOz: 16, lengthIn: 10, widthIn: 10, heightIn: 10 });
  const [testResult, setTestResult] = useState<TestQuoteResult | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingShippingApi, setSavingShippingApi] = useState(false);
  const [savingCustomStore, setSavingCustomStore] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/proxy/shipping/warehouse-address'),
      fetch('/api/proxy/shipping/diagnostics'),
      fetch('/api/proxy/fulfillment/shipstation-custom-store'),
      fetch(`/api/proxy/settings/${SHIPPING_API_SETTINGS_KEY}`),
    ])
      .then(async ([addressRes, diagnosticsRes, customStoreRes, shippingApiRes]) => {
        if (addressRes.ok) {
          const data = (await addressRes.json()) as WarehouseAddress | null;
          if (data) setForm({ ...emptyForm, ...data });
        }
        if (diagnosticsRes.ok) setDiagnostics((await diagnosticsRes.json()) as Record<string, unknown>);
        if (customStoreRes.ok) {
          const data = (await customStoreRes.json()) as CustomStoreConnection;
          setCustomStore({
            ...data,
            endpointUrl: `${window.location.origin}/api/shipstation/custom-store`,
          });
        }
        if (shippingApiRes.ok) {
          const setting = (await shippingApiRes.json()) as Setting | null;
          const shippingApi = parseJsonValue<Record<string, unknown>>(setting?.value);
          setShippingApiForm({
            provider: readOption(shippingApi?.provider, ['manual', 'shipstation', 'shippo', 'easypost'] as const, defaultShippingApiForm.provider),
            apiKey: readString(shippingApi?.apiKey, defaultShippingApiForm.apiKey),
            apiSecret: readString(shippingApi?.apiSecret, defaultShippingApiForm.apiSecret),
            accountId: readString(shippingApi?.accountId, defaultShippingApiForm.accountId),
            originPostalCode: readString(shippingApi?.originPostalCode, defaultShippingApiForm.originPostalCode),
            originCountry: readString(shippingApi?.originCountry, defaultShippingApiForm.originCountry),
            enabledCarrierCodes: readStringArray(shippingApi?.enabledCarrierCodes, defaultShippingApiForm.enabledCarrierCodes),
            allowedServiceCodes: readStringArray(shippingApi?.allowedServiceCodes, defaultShippingApiForm.allowedServiceCodes),
            markupType: readOption(shippingApi?.markupType, ['fixed', 'percentage'] as const, defaultShippingApiForm.markupType),
            markupAmount: readStringOrNumber(shippingApi?.markupAmount, defaultShippingApiForm.markupAmount),
          });
        }
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

  async function saveShippingApiSettings() {
    setSavingShippingApi(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/proxy/settings/${SHIPPING_API_SETTINGS_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(shippingApiForm) }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Failed to save shipping API settings.');
      setSuccess('Shipping API settings saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save shipping API settings.');
    } finally {
      setSavingShippingApi(false);
    }
  }

  async function saveCustomStoreSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingCustomStore(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/proxy/fulfillment/shipstation-custom-store', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customStoreForm),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CustomStoreConnection> & { message?: string };
      if (!res.ok) throw new Error(data.message ?? 'Failed to save ShipStation custom store credentials.');
      setCustomStore((current) => current ? {
        ...current,
        usernameConfigured: Boolean(data.usernameConfigured),
        passwordConfigured: Boolean(data.passwordConfigured),
      } : current);
      setCustomStoreForm({ username: '', password: '' });
      setSuccess('ShipStation custom store connection saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save ShipStation custom store connection.');
    } finally {
      setSavingCustomStore(false);
    }
  }

  async function copyDiagnosticReport() {
    if (!testResult) return;
    setCopyStatus('');
    const report = buildDiagnosticReport({
      diagnostics,
      testAddress,
      testPackage,
      testResult,
    });
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus('Diagnostic report copied.');
    } catch {
      setCopyStatus('Could not copy report. Open the raw JSON and copy it manually.');
    }
  }

  async function runTestQuote() {
    setTesting(true);
    setError('');
    setTestResult(null);
    setCopyStatus('');
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
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-3xl font-bold">Shipping</h1>
      <p className="mb-6 text-gray-500 text-sm">
        Manage ShipStation credentials, warehouse origin, live rate filters, custom store connection, and shipping diagnostics.
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

      <section className="mt-6 rounded-lg border bg-white p-5 text-sm shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">ShipStation API Settings</h2>
          <p className="text-gray-500">These settings power live checkout rates and fulfillment features.</p>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setShippingApiForm((currentForm) => ({
                ...currentForm,
                provider: 'shipstation',
                enabledCarrierCodes: ['usps', 'ups'],
                allowedServiceCodes: [],
                markupType: 'fixed',
                markupAmount: '0',
              }))
            }
            className="rounded border border-purple-200 bg-white px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-50"
          >
            Use PLShipping defaults
          </button>
          <button
            type="button"
            onClick={() =>
              setShippingApiForm((currentForm) => ({
                ...currentForm,
                provider: 'shipstation',
                enabledCarrierCodes: ['usps', 'ups'],
                allowedServiceCodes: preferredCheckoutServiceCodes,
              }))
            }
            className="rounded border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-800 hover:bg-purple-100"
          >
            Use preferred checkout services
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Provider
            <select
              value={shippingApiForm.provider}
              onChange={(event) =>
                setShippingApiForm((currentForm) => ({
                  ...currentForm,
                  provider: event.target.value as ShippingApiForm['provider'],
                }))
              }
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="manual">Manual</option>
              <option value="shipstation">ShipStation</option>
              <option value="shippo">Shippo</option>
              <option value="easypost">EasyPost</option>
            </select>
          </label>
          <input value={shippingApiForm.accountId} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, accountId: event.target.value }))} placeholder="Account ID" className="w-full rounded border px-3 py-2 text-sm md:mt-6" />
          <input value={shippingApiForm.apiKey} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, apiKey: event.target.value }))} placeholder="ShipStation API key" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={shippingApiForm.apiSecret} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, apiSecret: event.target.value }))} placeholder="ShipStation API secret" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={shippingApiForm.originPostalCode} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, originPostalCode: event.target.value }))} placeholder="Origin ZIP/postal code" className="w-full rounded border px-3 py-2 text-sm" />
          <input value={shippingApiForm.originCountry} onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, originCountry: event.target.value }))} placeholder="Origin country" className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Carriers to quote</p>
            <p className="mt-1 text-xs text-gray-500">Enable only carriers active in your ShipStation account.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['usps', 'USPS'],
                ['ups', 'UPS'],
                ['fedex', 'FedEx'],
                ['global_post', 'GlobalPost'],
              ].map(([code, label]) => (
                <label key={code} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={shippingApiForm.enabledCarrierCodes.includes(code)}
                    onChange={(event) =>
                      setShippingApiForm((currentForm) => ({
                        ...currentForm,
                        enabledCarrierCodes: event.target.checked
                          ? Array.from(new Set([...currentForm.enabledCarrierCodes, code]))
                          : currentForm.enabledCarrierCodes.filter((carrierCode) => carrierCode !== code),
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-700">Rate markup</p>
            <p className="mt-1 text-xs text-gray-500">Add a fixed dollar amount or percentage to live rates.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Markup type
                <select
                  value={shippingApiForm.markupType}
                  onChange={(event) =>
                    setShippingApiForm((currentForm) => ({
                      ...currentForm,
                      markupType: event.target.value as ShippingApiForm['markupType'],
                    }))
                  }
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Markup amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingApiForm.markupAmount}
                  onChange={(event) => setShippingApiForm((currentForm) => ({ ...currentForm, markupAmount: event.target.value }))}
                  placeholder={shippingApiForm.markupType === 'percentage' ? '10' : '2.50'}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700">Allowed ShipStation services</p>
          <p className="mt-1 text-xs text-gray-500">Leave all unchecked to show every returned service for enabled carriers.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {shipStationServiceOptions.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={shippingApiForm.allowedServiceCodes.includes(code)}
                  onChange={(event) =>
                    setShippingApiForm((currentForm) => ({
                      ...currentForm,
                      allowedServiceCodes: event.target.checked
                        ? Array.from(new Set([...currentForm.allowedServiceCodes, code]))
                        : currentForm.allowedServiceCodes.filter((serviceCode) => serviceCode !== code),
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void saveShippingApiSettings()}
            disabled={savingShippingApi}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {savingShippingApi ? 'Saving...' : 'Save Shipping API'}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-5 text-sm shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">ShipStation Custom Store Connection</h2>
        <p className="text-gray-500">
          Use this connection when adding PL_CMS as a Custom Store inside ShipStation.
          ShipStation will pull paid physical orders and send tracking updates back to PL_CMS.
        </p>
        <div className="mt-4 rounded bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Endpoint URL</p>
          <code className="mt-1 block break-all text-sm text-gray-900">
            {customStore?.endpointUrl ?? `${typeof window === 'undefined' ? '' : window.location.origin}/api/shipstation/custom-store`}
          </code>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Authentication</dt>
            <dd className="mt-1 text-gray-800">{customStore?.authentication ?? 'Basic HTTP Authentication'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Credentials</dt>
            <dd className="mt-1 text-gray-800">
              {customStore?.usernameConfigured && customStore.passwordConfigured ? 'Configured' : 'Not configured'}
            </dd>
          </div>
        </dl>
        <form onSubmit={saveCustomStoreSettings} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">Username
            <input
              value={customStoreForm.username}
              onChange={(event) => setCustomStoreForm((current) => ({ ...current, username: event.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Choose a username for ShipStation"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">Password
            <input
              type="password"
              value={customStoreForm.password}
              onChange={(event) => setCustomStoreForm((current) => ({ ...current, password: event.target.value }))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="Choose a strong password"
            />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={savingCustomStore} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {savingCustomStore ? 'Saving...' : 'Save Custom Store Credentials'}
            </button>
          </div>
        </form>
      </section>

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
          <label className="block text-sm font-medium text-gray-700">Address Type
            <select value={testAddress.addressType} onChange={(event) => setTestAddress((current) => ({ ...current, addressType: event.target.value as typeof defaultTestAddress.addressType }))} className="mt-1 w-full rounded border px-3 py-2 text-sm">
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void copyDiagnosticReport()}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Copy diagnostic report
              </button>
              {copyStatus && <span className="text-xs text-gray-600">{copyStatus}</span>}
            </div>
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
              <div className="mt-4 space-y-3">
                <p className="font-medium text-gray-800">Carrier attempt summary</p>
                {testResult.attempts.map((attempt) => (
                  <div key={`${attempt.carrierCode}-${attempt.status ?? 'pending'}`} className="rounded bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">{attempt.carrierCode}</span>
                      <span className="text-xs text-gray-500">
                        Status {attempt.status ?? 'not reached'} · {attempt.rateCount ?? 0} raw rate(s)
                      </span>
                    </div>
                    {attempt.error && <p className="mt-2 text-xs text-red-600">{attempt.error}</p>}
                    {attempt.services && attempt.services.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-gray-700">
                        {attempt.services.map((service) => (
                          <li key={`${attempt.carrierCode}-${service.serviceCode}`} className="flex justify-between gap-3">
                            <span>{service.serviceName || service.serviceCode}</span>
                            <span className="shrink-0 font-medium">
                              ${(Number(service.shipmentCost) + Number(service.otherCost)).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
            {testResult.attempts && testResult.attempts.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium text-gray-700">Raw carrier attempts JSON</summary>
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

function buildDiagnosticReport({
  diagnostics,
  testAddress,
  testPackage,
  testResult,
}: {
  diagnostics: Record<string, unknown> | null;
  testAddress: typeof defaultTestAddress;
  testPackage: { weightOz: number; lengthIn: number; widthIn: number; heightIn: number };
  testResult: TestQuoteResult;
}) {
  const lines = [
    'ShipStation Test Quote Diagnostic Report',
    `Result: ${testResult.success ? 'success' : 'failed'}`,
    testResult.message ? `Message: ${testResult.message}` : '',
    '',
    'Destination:',
    `${testAddress.city}, ${testAddress.state} ${testAddress.postalCode}, ${testAddress.country}`,
    `Address type: ${testAddress.addressType}`,
    '',
    'Package:',
    `${testPackage.weightOz} oz, ${testPackage.lengthIn}x${testPackage.widthIn}x${testPackage.heightIn} in`,
    '',
    'Diagnostics:',
    diagnostics ? JSON.stringify(diagnostics, null, 2) : 'No diagnostics loaded.',
    '',
    'Returned checkout rates:',
    ...(testResult.rates && testResult.rates.length > 0
      ? testResult.rates.map(
          (rate) =>
            `${rate.carrierCode} ${rate.serviceCode} - ${rate.serviceName}: $${(Number(rate.shipmentCost) + Number(rate.otherCost)).toFixed(2)}`,
        )
      : ['None']),
    '',
    'Carrier attempts:',
    ...(testResult.attempts && testResult.attempts.length > 0
      ? testResult.attempts.flatMap((attempt) => [
          `${attempt.carrierCode}: status ${attempt.status ?? 'not reached'}, ${attempt.rateCount ?? 0} raw rate(s)`,
          attempt.error ? `  Error: ${attempt.error}` : '',
          ...(attempt.services && attempt.services.length > 0
            ? attempt.services.map(
                (service) =>
                  `  ${service.serviceCode} - ${service.serviceName}: $${(Number(service.shipmentCost) + Number(service.otherCost)).toFixed(2)}`,
              )
            : ['  No services returned.']),
        ])
      : ['None']),
    '',
    'Raw attempts JSON:',
    JSON.stringify(testResult.attempts ?? [], null, 2),
  ];

  return lines.filter((line) => line !== '').join('\n');
}
