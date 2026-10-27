'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDateTime, type OrderTracking, type StageKey } from '../../lib/order-tracking';

type SettableStage = Exclude<StageKey, 'PLACED'>;
type Provider = 'usps' | 'ups' | 'other';

const STAGE_BUTTONS: Array<{ stage: SettableStage; label: string }> = [
  { stage: 'IN_PRODUCTION', label: 'Being made' },
  { stage: 'PACKAGING', label: 'Being packaged' },
  { stage: 'READY_TO_SHIP', label: 'Ready to ship' },
];

const STAGE_ORDER: StageKey[] = ['PLACED', 'IN_PRODUCTION', 'PACKAGING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'];

/**
 * Moves an order through being made, being packaged and ready to ship, and records the shipping provider and tracking number
 * when it ships. The customer sees the same steps (and, once shipped, the carrier's tracking) on their order's tracking page.
 */
export function OrderProgressPanel({ orderId, orderStatus, onChanged }: { orderId: string; orderStatus: string; onChanged?: () => void }) {
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [provider, setProvider] = useState<Provider>('usps');
  const [providerName, setProviderName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/proxy/orders/${encodeURIComponent(orderId)}/tracking`);
      if (!res.ok) return;
      const data = (await res.json()) as OrderTracking;
      setTracking(data);
      if (data.shipment) {
        const carrier = data.shipment.carrier;
        setProvider(carrier === 'USPS' ? 'usps' : carrier === 'UPS' ? 'ups' : 'other');
        setProviderName(carrier === 'USPS' || carrier === 'UPS' ? '' : carrier);
        setTrackingNumber(data.shipment.trackingNumber ?? '');
      }
    } catch {
      /* the panel still works without the current picture */
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/fulfillment/orders/${encodeURIComponent(orderId)}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        throw new Error(Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Could not update the order'));
      }
      setMessage(success);
      await load();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not update the order');
    } finally {
      setBusy(false);
    }
  }

  const closed = tracking?.timeline.closed ?? null;
  const unpaid = orderStatus === 'PENDING';
  const locked = busy || !!closed || unpaid;
  const currentIndex = tracking ? STAGE_ORDER.indexOf(tracking.timeline.currentStage) : 0;
  const shipped = currentIndex >= STAGE_ORDER.indexOf('SHIPPED');

  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Order progress</h2>
      <p className="text-sm text-gray-500">What the customer sees on their tracking page.</p>

      {tracking && (
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Current progress">
          {tracking.timeline.steps.map((step) => (
            <li
              key={step.key}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                step.current ? 'bg-indigo-600 text-white' : step.done ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}
              title={step.reachedAt ? formatDateTime(step.reachedAt) : undefined}
            >
              {step.done && !step.current ? '✓ ' : ''}
              {step.label}
            </li>
          ))}
        </ol>
      )}

      {closed && <p className="mt-3 rounded bg-gray-100 px-3 py-2 text-sm text-gray-700">This order was {closed === 'CANCELLED' ? 'cancelled' : 'refunded'}, so its progress cannot be changed.</p>}
      {unpaid && <p className="mt-3 rounded bg-yellow-50 px-3 py-2 text-sm text-yellow-800">This order has not been paid yet. Its progress can be updated once payment is received.</p>}

      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {message && (
        <p role="status" className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {STAGE_BUTTONS.map(({ stage, label }) => {
          const isCurrent = tracking?.timeline.currentStage === stage;
          const tooLate = shipped;
          return (
            <button
              key={stage}
              type="button"
              disabled={locked || isCurrent || tooLate}
              title={tooLate ? 'This order has already shipped' : undefined}
              onClick={() => void send({ stage }, `Marked as ${label.toLowerCase()}.`)}
              className="rounded border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {label}
            </button>
          );
        })}
      </div>

      <form
        className="mt-5 rounded-lg bg-gray-50 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send(
            { stage: 'SHIPPED', carrier: provider, ...(provider === 'other' ? { carrierName: providerName } : {}), trackingNumber },
            shipped ? 'Tracking details updated.' : 'Marked as shipped.',
          );
        }}
      >
        <h3 className="text-sm font-semibold">{shipped ? 'Shipping and tracking' : 'Mark as shipped'}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-gray-600">
            Shipping provider
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            >
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="other">Other</option>
            </select>
          </label>
          {provider === 'other' && (
            <label className="block text-xs font-medium text-gray-600">
              Provider name
              <input
                value={providerName}
                onChange={(event) => setProviderName(event.target.value)}
                maxLength={60}
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className={`block text-xs font-medium text-gray-600 ${provider === 'other' ? 'sm:col-span-2' : ''}`}>
            Tracking number
            <input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              maxLength={80}
              placeholder="e.g. 9400 1118 9922 3197 4284 90"
              className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={locked || !trackingNumber.trim() || (provider === 'other' && !providerName.trim())}
          className="mt-3 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : shipped ? 'Save tracking details' : 'Mark as shipped'}
        </button>
        {!shipped && <p className="mt-2 text-xs text-gray-500">The customer is emailed when it ships (if email is set up).</p>}
      </form>

      {shipped && tracking?.timeline.currentStage !== 'DELIVERED' && (
        <button
          type="button"
          disabled={locked}
          onClick={() => void send({ stage: 'DELIVERED' }, 'Marked as delivered.')}
          className="mt-3 rounded border border-green-300 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          Mark as delivered
        </button>
      )}
      {shipped && (
        <p className="mt-2 text-xs text-gray-500">
          When the carrier reports it delivered, the order is marked delivered automatically (this needs the ShipStation tracking key).
        </p>
      )}
    </section>
  );
}
