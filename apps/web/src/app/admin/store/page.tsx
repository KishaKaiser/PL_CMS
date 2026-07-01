'use client';

import { useCallback, useEffect, useState } from 'react';

interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  amount: number;
  minimumSubtotal: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
}

interface FreeShippingSettings {
  enabled: boolean;
  minimumSubtotal: number;
  label: string;
}

interface CartRecoverySettings {
  enabled: boolean;
  delayMinutes: number;
  expiresDays: number;
}

interface StoreEmailTemplate {
  key: string;
  subject: string;
  body: string;
  enabled: boolean;
}

interface EcommerceSettings {
  storeName: string;
  currency: string;
  orderPrefix: string;
  taxEnabled: boolean;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  guestCheckoutEnabled: boolean;
  requirePhone: boolean;
  inventoryTrackingEnabled: boolean;
  lowStockThreshold: number;
  holdStockMinutes: number;
  termsPageUrl: string;
}

const emptyCoupon: Coupon = {
  id: '',
  code: '',
  type: 'percent',
  amount: 10,
  minimumSubtotal: 0,
  startsAt: '',
  endsAt: '',
  enabled: true,
};

export default function AdminStorePage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponForm, setCouponForm] = useState<Coupon>(emptyCoupon);
  const [freeShipping, setFreeShipping] = useState<FreeShippingSettings>({ enabled: false, minimumSubtotal: 75, label: 'Free shipping' });
  const [cartRecovery, setCartRecovery] = useState<CartRecoverySettings>({ enabled: false, delayMinutes: 60, expiresDays: 7 });
  const [ecommerce, setEcommerce] = useState<EcommerceSettings>({
    storeName: 'Psychic Link Store',
    currency: 'USD',
    orderPrefix: 'PL',
    taxEnabled: false,
    taxRatePercent: 0,
    pricesIncludeTax: false,
    guestCheckoutEnabled: false,
    requirePhone: true,
    inventoryTrackingEnabled: true,
    lowStockThreshold: 5,
    holdStockMinutes: 30,
    termsPageUrl: '/terms',
  });
  const [carts, setCarts] = useState<Array<{ id: string; email?: string; subtotal: number; status: string; createdAt: string; recoverAfter: string }>>([]);
  const [emails, setEmails] = useState<StoreEmailTemplate[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStore = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ecommerceRes, couponsRes, freeRes, recoveryRes, cartsRes, emailsRes] = await Promise.all([
        fetch('/api/proxy/store/admin/ecommerce'),
        fetch('/api/proxy/store/admin/coupons'),
        fetch('/api/proxy/store/admin/free-shipping'),
        fetch('/api/proxy/store/admin/cart-recovery'),
        fetch('/api/proxy/store/admin/cart-recovery/carts'),
        fetch('/api/proxy/store/admin/emails'),
      ]);
      if (!ecommerceRes.ok || !couponsRes.ok || !freeRes.ok || !recoveryRes.ok || !cartsRes.ok || !emailsRes.ok) throw new Error('Could not load store settings.');
      setEcommerce((await ecommerceRes.json()) as EcommerceSettings);
      setCoupons((await couponsRes.json()) as Coupon[]);
      setFreeShipping((await freeRes.json()) as FreeShippingSettings);
      setCartRecovery((await recoveryRes.json()) as CartRecoverySettings);
      setCarts((await cartsRes.json()) as Array<{ id: string; email?: string; subtotal: number; status: string; createdAt: string; recoverAfter: string }>);
      setEmails((await emailsRes.json()) as StoreEmailTemplate[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load store settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStore();
  }, [fetchStore]);

  async function saveCoupon(event: React.FormEvent) {
    event.preventDefault();
    await save('/api/proxy/store/admin/coupons', couponForm, 'Coupon saved.');
    setCouponForm(emptyCoupon);
    await fetchStore();
  }

  async function deleteCoupon(id: string) {
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/proxy/store/admin/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete coupon.');
      setMessage('Coupon deleted.');
      await fetchStore();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete coupon.');
    }
  }

  async function save(url: string, value: unknown, success: string, method = 'POST') {
    setMessage('');
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Save failed.');
      }
      setMessage(success);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Store Settings</h1>
        <p className="mt-1 text-sm text-gray-600">Manage coupons, free shipping, cart recovery, and store email copy.</p>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
      {loading ? <p className="text-gray-500">Loading store settings...</p> : (
        <div className="space-y-8">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Ecommerce</h2>
              <p className="text-sm text-gray-500">Set store-wide checkout, tax, inventory, and order defaults.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium text-gray-700">Store Name<input value={ecommerce.storeName} onChange={(event) => setEcommerce((current) => ({ ...current, storeName: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Currency<select value={ecommerce.currency} onChange={(event) => setEcommerce((current) => ({ ...current, currency: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm"><option value="USD">USD</option><option value="CAD">CAD</option><option value="GBP">GBP</option><option value="EUR">EUR</option></select></label>
              <label className="block text-sm font-medium text-gray-700">Order Prefix<input value={ecommerce.orderPrefix} onChange={(event) => setEcommerce((current) => ({ ...current, orderPrefix: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Tax Rate %<input type="number" min="0" step="0.01" value={ecommerce.taxRatePercent} onChange={(event) => setEcommerce((current) => ({ ...current, taxRatePercent: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Low Stock Threshold<input type="number" min="0" value={ecommerce.lowStockThreshold} onChange={(event) => setEcommerce((current) => ({ ...current, lowStockThreshold: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700">Hold Stock Minutes<input type="number" min="0" value={ecommerce.holdStockMinutes} onChange={(event) => setEcommerce((current) => ({ ...current, holdStockMinutes: Number(event.target.value) }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-gray-700 md:col-span-3">Terms Page URL<input value={ecommerce.termsPageUrl} onChange={(event) => setEcommerce((current) => ({ ...current, termsPageUrl: event.target.value }))} className="mt-1 w-full rounded border px-3 py-2 text-sm" /></label>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ecommerce.taxEnabled} onChange={(event) => setEcommerce((current) => ({ ...current, taxEnabled: event.target.checked }))} /> Enable tax calculation</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ecommerce.pricesIncludeTax} onChange={(event) => setEcommerce((current) => ({ ...current, pricesIncludeTax: event.target.checked }))} /> Product prices include tax</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ecommerce.guestCheckoutEnabled} onChange={(event) => setEcommerce((current) => ({ ...current, guestCheckoutEnabled: event.target.checked }))} /> Allow guest checkout</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ecommerce.requirePhone} onChange={(event) => setEcommerce((current) => ({ ...current, requirePhone: event.target.checked }))} /> Require phone at checkout</label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={ecommerce.inventoryTrackingEnabled} onChange={(event) => setEcommerce((current) => ({ ...current, inventoryTrackingEnabled: event.target.checked }))} /> Track product inventory</label>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void save('/api/proxy/store/admin/ecommerce', ecommerce, 'Ecommerce settings saved.', 'PUT')} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Ecommerce Settings</button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Coupons</h2>
            <form onSubmit={saveCoupon} className="mt-4 grid gap-4 md:grid-cols-6">
              <input required value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value }))} placeholder="Code" className="rounded border px-3 py-2 text-sm" />
              <select value={couponForm.type} onChange={(event) => setCouponForm((current) => ({ ...current, type: event.target.value as Coupon['type'] }))} className="rounded border px-3 py-2 text-sm">
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
              <input type="number" min="0" step="0.01" value={couponForm.amount} onChange={(event) => setCouponForm((current) => ({ ...current, amount: Number(event.target.value) }))} placeholder="Amount" className="rounded border px-3 py-2 text-sm" />
              <input type="number" min="0" step="0.01" value={couponForm.minimumSubtotal} onChange={(event) => setCouponForm((current) => ({ ...current, minimumSubtotal: Number(event.target.value) }))} placeholder="Minimum subtotal" className="rounded border px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={couponForm.enabled} onChange={(event) => setCouponForm((current) => ({ ...current, enabled: event.target.checked }))} /> Enabled</label>
              <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Coupon</button>
            </form>
            <div className="mt-5 overflow-auto rounded border">
              <table className="w-full text-sm">
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-semibold">{coupon.code}</td>
                      <td className="px-3 py-2">{coupon.type === 'percent' ? `${coupon.amount}%` : `$${coupon.amount.toFixed(2)}`}</td>
                      <td className="px-3 py-2">Min ${coupon.minimumSubtotal.toFixed(2)}</td>
                      <td className="px-3 py-2">{coupon.enabled ? 'Enabled' : 'Disabled'}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => setCouponForm(coupon)} className="mr-3 text-indigo-600 hover:underline">Edit</button>
                        <button type="button" onClick={() => void deleteCoupon(coupon.id)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && <tr><td className="px-3 py-4 text-gray-500">No coupons yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Free Shipping</h2>
              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={freeShipping.enabled} onChange={(event) => setFreeShipping((current) => ({ ...current, enabled: event.target.checked }))} /> Enable free shipping</label>
                <input type="number" min="0" step="0.01" value={freeShipping.minimumSubtotal} onChange={(event) => setFreeShipping((current) => ({ ...current, minimumSubtotal: Number(event.target.value) }))} className="w-full rounded border px-3 py-2 text-sm" placeholder="Minimum subtotal" />
                <input value={freeShipping.label} onChange={(event) => setFreeShipping((current) => ({ ...current, label: event.target.value }))} className="w-full rounded border px-3 py-2 text-sm" placeholder="Label" />
                <button type="button" onClick={() => void save('/api/proxy/store/admin/free-shipping', freeShipping, 'Free shipping saved.', 'PUT')} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Free Shipping</button>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Cart Recovery</h2>
              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cartRecovery.enabled} onChange={(event) => setCartRecovery((current) => ({ ...current, enabled: event.target.checked }))} /> Track recoverable carts</label>
                <input type="number" min="1" value={cartRecovery.delayMinutes} onChange={(event) => setCartRecovery((current) => ({ ...current, delayMinutes: Number(event.target.value) }))} className="w-full rounded border px-3 py-2 text-sm" placeholder="Delay minutes" />
                <input type="number" min="1" value={cartRecovery.expiresDays} onChange={(event) => setCartRecovery((current) => ({ ...current, expiresDays: Number(event.target.value) }))} className="w-full rounded border px-3 py-2 text-sm" placeholder="Expires days" />
                <button type="button" onClick={() => void save('/api/proxy/store/admin/cart-recovery', cartRecovery, 'Cart recovery saved.', 'PUT')} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Cart Recovery</button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Recovered Carts</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {carts.slice(0, 10).map((cart) => (
                <div key={cart.id} className="rounded border p-3 text-sm">
                  <div className="font-medium">{cart.email || 'No email yet'}</div>
                  <div className="text-gray-500">${Number(cart.subtotal).toFixed(2)} · {cart.status}</div>
                  <div className="text-xs text-gray-400">Recover after {new Date(cart.recoverAfter).toLocaleString()}</div>
                </div>
              ))}
              {carts.length === 0 && <p className="text-sm text-gray-500">No recoverable carts yet.</p>}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Store Emails</h2>
            <div className="mt-4 space-y-4">
              {emails.map((template, index) => (
                <div key={template.key} className="rounded-lg border p-4">
                  <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={template.enabled} onChange={(event) => setEmails((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))} /> {template.key.replaceAll('_', ' ')}</label>
                  <input value={template.subject} onChange={(event) => setEmails((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, subject: event.target.value } : item))} className="mb-3 w-full rounded border px-3 py-2 text-sm" />
                  <textarea value={template.body} rows={4} onChange={(event) => setEmails((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item))} className="w-full rounded border px-3 py-2 text-sm" />
                </div>
              ))}
              <button type="button" onClick={() => void save('/api/proxy/store/admin/emails', emails, 'Store emails saved.', 'PUT')} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Save Store Emails</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
