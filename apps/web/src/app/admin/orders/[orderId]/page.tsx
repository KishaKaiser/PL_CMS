'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
}

interface Inventory {
  onHand: number;
  reserved: number;
}

interface Variant {
  id: string;
  color: string;
  sku: string;
  inventory?: Inventory | null;
}

interface Product {
  id: string;
  name: string;
  type: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: Product;
  variant?: Variant | null;
}

interface Payment {
  id: string;
  status: string;
  amount: number;
  method: string;
}

interface Shipment {
  id: string;
  status: string;
  carrier?: string | null;
  service?: string | null;
  trackingNumber?: string | null;
  labelUrl?: string | null;
  shipstationShipmentId?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  payerEmail?: string | null;
  shippingCarrier?: string | null;
  shippingService?: string | null;
  shippingAmount?: number | null;
  user: { id: string; email: string; name: string };
  items: OrderItem[];
  shippingAddress?: ShippingAddress | null;
  shipments: Shipment[];
  payments: Payment[];
}

interface ShipStationService {
  carrierCode: string;
  carrierName: string;
  serviceCode: string;
  serviceName: string;
}

const ORDER_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'COMPLETED', label: 'Complete' },
  { value: 'CANCELLED', label: 'Canceled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
};

const SHIPMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  LABEL_PURCHASED: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? '';

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [shipStationServices, setShipStationServices] = useState<ShipStationService[]>([]);
  const [orderStatus, setOrderStatus] = useState('');
  const [updatingOrder, setUpdatingOrder] = useState(false);

  // Buy label form
  const [carrierCode, setCarrierCode] = useState('');
  const [serviceCode, setServiceCode] = useState('');
  const [buying, setBuying] = useState(false);

  // Update shipment status
  const [updatingShipmentId, setUpdatingShipmentId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newTracking, setNewTracking] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/fulfillment/orders/${orderId}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Failed to load order');
      }
      const json = (await res.json()) as Order;
      setOrder(json);
      setOrderStatus(json.status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    fetch('/api/proxy/shipping/shipstation-services')
      .then((res) => res.ok ? res.json() : [])
      .then((data: ShipStationService[]) => setShipStationServices(data))
      .catch(() => undefined);
  }, []);

  async function handleBuyLabel(e: React.FormEvent) {
    e.preventDefault();
    setBuying(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/proxy/fulfillment/orders/${orderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrierCode, serviceCode }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Failed to purchase label');
      }
      setActionSuccess('Label purchased successfully! Shipment created.');
      setCarrierCode('');
      setServiceCode('');
      await fetchOrder();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error purchasing label');
    } finally {
      setBuying(false);
    }
  }

  async function handleUpdateStatus(shipmentId: string) {
    if (!newStatus) return;
    setUpdatingShipmentId(shipmentId);
    setActionError('');
    setActionSuccess('');
    try {
      const body: { status: string; trackingNumber?: string } = { status: newStatus };
      if (newTracking) body.trackingNumber = newTracking;

      const res = await fetch(`/api/proxy/fulfillment/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Failed to update status');
      }
      setActionSuccess(`Shipment status updated to ${newStatus}.`);
      setNewStatus('');
      setNewTracking('');
      await fetchOrder();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error updating status');
    } finally {
      setUpdatingShipmentId(null);
    }
  }

  async function handleUpdateOrderStatus() {
    if (!orderStatus || orderStatus === order?.status) return;
    setUpdatingOrder(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/proxy/fulfillment/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: orderStatus }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Failed to update order status');
      }
      setActionSuccess(`Order status updated to ${orderStatus}.`);
      await fetchOrder();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error updating order status');
    } finally {
      setUpdatingOrder(false);
    }
  }

  if (loading) return <main className="p-8"><p className="text-gray-500">Loading order…</p></main>;
  if (error) return <main className="p-8"><p className="text-red-600">{error}</p></main>;
  if (!order) return null;

  const canFulfill = ['CONFIRMED', 'PROCESSING'].includes(order.status);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Order Detail</h1>
          <p className="mt-1 font-mono text-sm text-gray-500">{order.id}</p>
        </div>
        <a href="/admin/orders" className="text-sm text-indigo-600 hover:underline">
          ← Back to Orders
        </a>
      </div>

      {actionError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: order info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status + summary */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Order Summary</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {order.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
              <label className="block text-xs font-medium text-gray-600">
                Order Status
                <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="mt-1 rounded border px-3 py-2 text-sm">
                  {ORDER_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void handleUpdateOrderStatus()} disabled={updatingOrder || orderStatus === order.status} className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                {updatingOrder ? 'Updating...' : 'Update Status'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Customer:</span>{' '}
                <span className="font-medium">{order.user.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{' '}
                <span>{order.user.email}</span>
              </div>
              {order.payerEmail && order.payerEmail !== order.user.email && (
                <div>
                  <span className="text-gray-500">Payer email:</span>{' '}
                  <span>{order.payerEmail}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Placed:</span>{' '}
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Total:</span>{' '}
                <span className="font-semibold">
                  ${Number(order.totalAmount).toFixed(2)} {order.currency}
                </span>
              </div>
              {order.payments[0] && (
                <div>
                  <span className="text-gray-500">Payment:</span>{' '}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${order.payments[0].status === 'SUCCEEDED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}
                  >
                    {order.payments[0].status}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Order items */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Items</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold text-gray-500">
                  <th className="pb-2 text-left">Product</th>
                  <th className="pb-2 text-left">Variant</th>
                  <th className="pb-2 text-right">Qty</th>
                  <th className="pb-2 text-right">Unit Price</th>
                  <th className="pb-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-xs text-gray-400">{item.product.type}</div>
                    </td>
                    <td className="py-2">
                      {item.variant ? (
                        <div>
                          <span
                            className="mr-1 inline-block h-3 w-3 rounded-full border"
                            style={{ backgroundColor: item.variant.color }}
                          />
                          {item.variant.color}
                          <div className="font-mono text-xs text-gray-400">{item.variant.sku}</div>
                          {item.variant.inventory && (
                            <div className="text-xs text-gray-400">
                              Stock: {item.variant.inventory.onHand} / Reserved: {item.variant.inventory.reserved}
                            </div>
                          )}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-2 text-right font-medium">
                      ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {(order.shippingAmount != null) && (
                <tfoot>
                  <tr className="border-t">
                    <td colSpan={4} className="pt-2 text-right text-sm text-gray-500">
                      Shipping ({order.shippingCarrier} / {order.shippingService}):
                    </td>
                    <td className="pt-2 text-right font-medium">
                      ${Number(order.shippingAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </section>

          {/* Shipments */}
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Shipments</h2>

            {order.shipments.length === 0 ? (
              <p className="text-sm text-gray-500">No shipments yet.</p>
            ) : (
              <div className="space-y-4">
                {order.shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SHIPMENT_STATUS_COLORS[shipment.status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {shipment.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            Created {new Date(shipment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {shipment.carrier && (
                          <div>
                            <span className="text-gray-500">Carrier:</span>{' '}
                            {shipment.carrier} / {shipment.service}
                          </div>
                        )}
                        {shipment.trackingNumber && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Tracking:</span>{' '}
                            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                              {shipment.trackingNumber}
                            </code>
                            <button
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(shipment.trackingNumber!)
                                  .then(() => setActionSuccess('Tracking number copied!'))
                                  .catch(() => setActionError('Failed to copy tracking number'))
                              }
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                        {shipment.labelUrl && (
                          <div>
                            <a
                              href={shipment.labelUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              View Label →
                            </a>
                          </div>
                        )}
                        {shipment.shippedAt && (
                          <div className="text-xs text-gray-400">
                            Shipped: {new Date(shipment.shippedAt).toLocaleString()}
                          </div>
                        )}
                        {shipment.deliveredAt && (
                          <div className="text-xs text-gray-400">
                            Delivered: {new Date(shipment.deliveredAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Status update controls */}
                      {!['DELIVERED', 'CANCELLED'].includes(shipment.status) && (
                        <div className="flex flex-col gap-2">
                          <select
                            value={updatingShipmentId === shipment.id ? newStatus : ''}
                            onChange={(e) => {
                              setUpdatingShipmentId(shipment.id);
                              setNewStatus(e.target.value);
                            }}
                            className="rounded border px-2 py-1 text-xs"
                          >
                            <option value="">Update status…</option>
                            {shipment.status !== 'SHIPPED' && (
                              <option value="SHIPPED">Mark as Shipped</option>
                            )}
                            <option value="DELIVERED">Mark as Delivered</option>
                            <option value="CANCELLED">Cancel Shipment</option>
                          </select>
                          {updatingShipmentId === shipment.id && newStatus === 'SHIPPED' && (
                            <input
                              value={newTracking}
                              onChange={(e) => setNewTracking(e.target.value)}
                              placeholder="Tracking number (optional)"
                              className="rounded border px-2 py-1 text-xs"
                            />
                          )}
                          {updatingShipmentId === shipment.id && newStatus && (
                            <button
                              onClick={() => void handleUpdateStatus(shipment.id)}
                              className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-700"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column: address + buy label */}
        <div className="space-y-6">
          {/* Shipping address */}
          {order.shippingAddress && (
            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-base font-semibold">Ship To</h2>
              <div className="text-sm text-gray-700">
                <p className="font-medium">{order.shippingAddress.fullName}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postalCode}
                </p>
                <p>{order.shippingAddress.country}</p>
                <p className="mt-1 text-gray-500">{order.shippingAddress.phone}</p>
                <p className="text-gray-500">{order.shippingAddress.email}</p>
              </div>
            </section>
          )}

          {/* Buy label */}
          {canFulfill && order.shippingAddress && (
            <section className="rounded-lg border bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-semibold">Purchase Shipping Label</h2>
              <form onSubmit={handleBuyLabel} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    ShipStation Service *
                  </label>
                  <select
                    required
                    value={`${carrierCode}|${serviceCode}`}
                    onChange={(e) => {
                      const [carrier, service] = e.target.value.split('|');
                      setCarrierCode(carrier ?? '');
                      setServiceCode(service ?? '');
                    }}
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="|">Choose a service</option>
                    {shipStationServices.map((service) => (
                      <option key={`${service.carrierCode}-${service.serviceCode}`} value={`${service.carrierCode}|${service.serviceCode}`}>
                        {service.carrierName} - {service.serviceName}
                      </option>
                    ))}
                  </select>
                  {order.shippingCarrier && (
                    <p className="mt-1 text-xs text-gray-400">
                      Customer selected: {order.shippingCarrier} / {order.shippingService}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={buying}
                  className="w-full rounded bg-indigo-600 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {buying ? 'Purchasing…' : 'Buy Label via ShipStation'}
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
