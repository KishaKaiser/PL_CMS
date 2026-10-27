'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatDateTime, formatDay, type OrderTracking } from '../../../../lib/order-tracking';

/** Where one order is: the steps it goes through, and once it has shipped, what the carrier says about the package. */
export default function OrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? '';
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/proxy/orders/${encodeURIComponent(orderId)}/tracking`)
      .then(async (res) => {
        if (res.status === 404) throw new Error('We could not find that order.');
        if (!res.ok) throw new Error('We could not load the tracking for this order. Please try again.');
        return (await res.json()) as OrderTracking;
      })
      .then((data) => {
        if (!cancelled) setTracking(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'We could not load the tracking for this order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Track your order</h1>
        <a href="/client/orders" className="text-sm text-indigo-600 hover:underline">
          ← My Orders
        </a>
      </div>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tracking && <TrackingDetails tracking={tracking} />}
    </main>
  );
}

function TrackingDetails({ tracking }: { tracking: OrderTracking }) {
  const { timeline, shipment, live } = tracking;
  const showCarrierLink = Boolean(shipment?.trackingUrl);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <p className="font-mono text-xs text-gray-400">Order #{tracking.orderId}</p>
        <p className="mt-1 text-sm text-gray-600">Placed {formatDay(tracking.placedAt)}</p>

        {timeline.closed ? (
          <p className="mt-4 rounded bg-gray-100 px-4 py-3 text-sm text-gray-700">
            {timeline.closed === 'CANCELLED' ? 'This order was cancelled.' : 'This order was refunded.'}
          </p>
        ) : (
          <ol className="mt-5" aria-label="Order progress">
            {timeline.steps.map((step, index) => {
              const last = index === timeline.steps.length - 1;
              return (
                <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0" aria-current={step.current ? 'step' : undefined}>
                  {!last && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 ${timeline.steps[index + 1].done ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      step.done ? 'bg-indigo-600 text-white' : 'border-2 border-gray-300 bg-white text-gray-300'
                    } ${step.current ? 'ring-4 ring-indigo-100' : ''}`}
                  >
                    {step.done ? '✓' : index + 1}
                  </span>
                  <div className="pt-1">
                    <p className={`font-semibold ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                      {step.current && <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Now</span>}
                    </p>
                    {step.reachedAt && <p className="text-sm text-gray-500">{formatDateTime(step.reachedAt)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {shipment && (
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Shipping</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">Shipped with</dt>
              <dd className="font-medium">{shipment.carrier || '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Tracking number</dt>
              <dd className="break-all font-mono font-medium">{shipment.trackingNumber}</dd>
            </div>
            {shipment.shippedAt && (
              <div>
                <dt className="text-gray-500">Shipped</dt>
                <dd className="font-medium">{formatDay(shipment.shippedAt)}</dd>
              </div>
            )}
            {(live?.estimatedDelivery || live?.deliveredAt || shipment.deliveredAt) && (
              <div>
                <dt className="text-gray-500">{live?.deliveredAt || shipment.deliveredAt ? 'Delivered' : 'Estimated delivery'}</dt>
                <dd className="font-medium">{formatDay(live?.deliveredAt || shipment.deliveredAt || live?.estimatedDelivery)}</dd>
              </div>
            )}
          </dl>

          {live && (
            <div className="mt-5 border-t pt-4">
              <p className={`text-base font-semibold ${live.exception ? 'text-red-700' : live.delivered ? 'text-green-700' : 'text-gray-900'}`}>
                {live.statusLabel}
              </p>
              {live.events.length > 0 && (
                <ul className="mt-3 space-y-3">
                  {live.events.map((event, index) => (
                    <li key={`${event.at}-${index}`} className="border-l-2 border-gray-200 pl-4">
                      <p className="text-sm font-medium text-gray-900">{event.description}</p>
                      <p className="text-xs text-gray-500">
                        {[formatDateTime(event.at), event.location].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!live && tracking.liveStatus && (
            <p className="mt-4 text-sm text-gray-500">
              {shipment.trackingUrl
                ? `Detailed delivery updates are on the ${shipment.carrier} website.`
                : 'Use the tracking number above on the carrier’s website for delivery updates.'}
            </p>
          )}

          {showCarrierLink && shipment.trackingUrl && (
            <a
              href={shipment.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Track on {shipment.carrier}
            </a>
          )}
        </section>
      )}

      {tracking.items.length > 0 && (
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">In this order</h2>
          <ul className="mt-3 divide-y text-sm">
            {tracking.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="py-2">
                <span className="font-medium">{item.name}</span> <span className="text-gray-500">× {item.quantity}</span>
                {item.summary && <p className="text-xs text-gray-500">{item.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
