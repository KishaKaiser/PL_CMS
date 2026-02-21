'use client';

import { useState, useEffect } from 'react';

interface ShippingAddress {
  fullName: string;
  city: string;
  state: string;
  postalCode: string;
}

interface Product {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  color: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: Product;
  variant?: Variant | null;
}

interface Shipment {
  id: string;
  status: string;
  carrier?: string | null;
  service?: string | null;
  trackingNumber?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  items: OrderItem[];
  shippingAddress?: ShippingAddress | null;
  shipments: Shipment[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

const TRACKING_BASE_URLS: Record<string, string> = {
  stamps_com: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  fedex: 'https://www.fedex.com/fedextrack/?tracknumbers=',
  ups: 'https://www.ups.com/track?tracknum=',
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
};

function getTrackingUrl(carrier: string | null | undefined, tracking: string): string | null {
  if (!carrier) return null;
  const base = TRACKING_BASE_URLS[carrier.toLowerCase()];
  return base ? `${base}${encodeURIComponent(tracking)}` : null;
}

export default function ClientOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/proxy/checkout/orders')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load orders');
        return r.json() as Promise<Order[]>;
      })
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load orders'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
        <a href="/client" className="text-sm text-indigo-600 hover:underline">
          ← Client Portal
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center">
          <p className="text-gray-500">You have no orders yet.</p>
          <a href="/shop" className="mt-4 inline-block text-indigo-600 hover:underline">
            Browse the Shop →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            // Show latest non-cancelled shipment first, then any cancelled ones
            const latestShipment = order.shipments.find((s) => s.status !== 'CANCELLED') ?? order.shipments[0];
            const isExpanded = expandedId === order.id;

            return (
              <div key={order.id} className="rounded-lg border bg-white shadow-sm">
                {/* Order header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gray-400">
                        #{order.id.slice(0, 12)}…
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()} ·{' '}
                      <span className="font-medium text-gray-700">
                        ${Number(order.totalAmount).toFixed(2)} {order.currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Shipment tracking highlight */}
                    {latestShipment && (
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-700">
                          {latestShipment.status === 'DELIVERED'
                            ? '✅ Delivered'
                            : latestShipment.status === 'SHIPPED'
                            ? '🚚 In Transit'
                            : latestShipment.status === 'LABEL_PURCHASED'
                            ? '📦 Label Created'
                            : latestShipment.status === 'CANCELLED'
                            ? '❌ Shipment Cancelled'
                            : latestShipment.status}
                        </div>
                        {latestShipment.trackingNumber && (
                          <div className="text-xs text-gray-500">
                            {latestShipment.carrier && (
                              <span className="capitalize">{latestShipment.carrier} · </span>
                            )}
                            {(() => {
                              const trackUrl = getTrackingUrl(
                                latestShipment.carrier,
                                latestShipment.trackingNumber,
                              );
                              return trackUrl ? (
                                <a
                                  href={trackUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-indigo-600 hover:underline"
                                >
                                  Track: {latestShipment.trackingNumber}
                                </a>
                              ) : (
                                <span>{latestShipment.trackingNumber}</span>
                              );
                            })()}
                          </div>
                        )}
                        {latestShipment.deliveredAt && (
                          <div className="text-xs text-gray-400">
                            {new Date(latestShipment.deliveredAt).toLocaleDateString()}
                          </div>
                        )}
                        {latestShipment.shippedAt && !latestShipment.deliveredAt && (
                          <div className="text-xs text-gray-400">
                            Shipped {new Date(latestShipment.shippedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      {isExpanded ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                </div>

                {/* Order items + shipment details */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-5">
                    <h3 className="mb-2 text-sm font-semibold text-gray-700">Items</h3>
                    <ul className="mb-4 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between">
                          <span>
                            {item.product.name}
                            {item.variant && (
                              <span className="ml-1 text-gray-400">({item.variant.color})</span>
                            )}
                            {' × '}
                            {item.quantity}
                          </span>
                          <span className="font-medium">
                            ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {order.shippingAddress && (
                      <div className="mb-4 text-sm">
                        <h3 className="mb-1 font-semibold text-gray-700">Shipping Address</h3>
                        <p>
                          {order.shippingAddress.fullName},{' '}
                          {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                          {order.shippingAddress.postalCode}
                        </p>
                      </div>
                    )}

                    {order.shipments.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-700">
                          Shipment History
                        </h3>
                        <div className="space-y-2">
                          {order.shipments.map((s) => (
                            <div
                              key={s.id}
                              className="flex flex-wrap items-center justify-between rounded border bg-white px-3 py-2 text-xs"
                            >
                              <div>
                                <span className="font-medium">{s.status}</span>
                                {s.carrier && (
                                  <span className="ml-2 text-gray-500">
                                    {s.carrier} / {s.service}
                                  </span>
                                )}
                              </div>
                              {s.trackingNumber && (
                                <div>
                                  {(() => {
                                    const trackUrl = getTrackingUrl(s.carrier, s.trackingNumber);
                                    return trackUrl ? (
                                      <a
                                        href={trackUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 hover:underline"
                                      >
                                        Track {s.trackingNumber}
                                      </a>
                                    ) : (
                                      <code>{s.trackingNumber}</code>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
