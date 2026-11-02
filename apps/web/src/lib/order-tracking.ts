/** What `GET /orders/:id/tracking` and `POST /orders/lookup` return: where an order is, its shipment, and what the carrier says. */

export type StageKey = 'PLACED' | 'IN_PRODUCTION' | 'PACKAGING' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED';

export interface TrackingStep {
  key: StageKey;
  label: string;
  done: boolean;
  current: boolean;
  reachedAt: string | null;
}

export interface TrackingEvent {
  at: string | null;
  description: string;
  location: string;
}

export interface OrderTracking {
  orderId: string;
  /** The number customers know the order by, e.g. 1042 and PL-1042. */
  orderNumber: number;
  orderLabel: string;
  placedAt: string;
  status: string;
  timeline: { steps: TrackingStep[]; currentStage: StageKey; closed: 'CANCELLED' | 'REFUNDED' | null };
  shipment: {
    carrier: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
  live: {
    statusCode: string;
    statusLabel: string;
    delivered: boolean;
    exception: boolean;
    estimatedDelivery: string | null;
    deliveredAt: string | null;
    events: TrackingEvent[];
  } | null;
  /** Why there is no live information: no key saved, a carrier it is not asked about, or it did not answer. */
  liveStatus: 'not_configured' | 'unsupported' | 'unavailable' | null;
  items: Array<{ name: string; quantity: number; summary: string | null }>;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDay(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}
