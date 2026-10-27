/**
 * Order progress: the steps an order goes through, what the carrier says about a shipment, and the small helpers both need.
 * Everything here is plain functions, so it can be checked without a database.
 */

// ── Steps ─────────────────────────────────────────────────────────────────────────────

export const ORDER_STAGE_STEPS = [
  { key: 'PLACED', label: 'Order placed' },
  { key: 'IN_PRODUCTION', label: 'Being made' },
  { key: 'PACKAGING', label: 'Being packaged' },
  { key: 'READY_TO_SHIP', label: 'Ready to ship' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const;

export type StageKey = (typeof ORDER_STAGE_STEPS)[number]['key'];
/** The steps an admin can set (an order is "placed" from the moment it exists). */
export type SettableStage = Exclude<StageKey, 'PLACED'>;

export const SETTABLE_STAGES: SettableStage[] = ['IN_PRODUCTION', 'PACKAGING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'];

export function stageIndex(stage: string) {
  return ORDER_STAGE_STEPS.findIndex((step) => step.key === stage);
}

export interface TimelineInput {
  createdAt: Date;
  updatedAt: Date;
  status: string;
  events: Array<{ stage: string; createdAt: Date }>;
  shipments: Array<{ status: string; shippedAt: Date | null; deliveredAt: Date | null; createdAt: Date }>;
}

export interface TimelineStep {
  key: StageKey;
  label: string;
  /** This step, or one after it, has been reached. */
  done: boolean;
  /** This is where the order is now. */
  current: boolean;
  reachedAt: string | null;
}

export interface Timeline {
  steps: TimelineStep[];
  currentStage: StageKey;
  /** Set when the order was cancelled or refunded, so the page can say so instead of showing progress. */
  closed: 'CANCELLED' | 'REFUNDED' | null;
}

/**
 * Works out where an order is. The steps an admin set are used, together with what the shipment says (ShipStation can mark
 * an order shipped without anyone setting a step), and whichever happened last wins.
 */
export function buildTimeline(order: TimelineInput): Timeline {
  const events = [...order.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const latestEvent = events[events.length - 1];
  const shipment = [...order.shipments]
    .filter((entry) => entry.status !== 'CANCELLED')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  let derived: { stage: 'SHIPPED' | 'DELIVERED'; at: Date } | null = null;
  if (order.status === 'COMPLETED' || shipment?.status === 'DELIVERED') {
    derived = { stage: 'DELIVERED', at: shipment?.deliveredAt ?? order.updatedAt };
  } else if (order.status === 'SHIPPED' || shipment?.status === 'SHIPPED') {
    derived = { stage: 'SHIPPED', at: shipment?.shippedAt ?? order.updatedAt };
  }

  const currentStage: StageKey =
    derived && (!latestEvent || derived.at.getTime() >= latestEvent.createdAt.getTime())
      ? derived.stage
      : ((latestEvent?.stage as StageKey | undefined) ?? 'PLACED');
  const currentIndex = stageIndex(currentStage);

  const reachedAt = (stage: StageKey): Date | null => {
    if (stage === 'PLACED') return order.createdAt;
    const event = [...events].reverse().find((entry) => entry.stage === stage);
    if (event) return event.createdAt;
    if (derived?.stage === stage) return derived.at;
    if (stage === 'SHIPPED') return shipment?.shippedAt ?? null;
    if (stage === 'DELIVERED') return shipment?.deliveredAt ?? null;
    return null;
  };

  const steps = ORDER_STAGE_STEPS.map((step, index): TimelineStep => ({
    key: step.key,
    label: step.label,
    done: index <= currentIndex,
    current: index === currentIndex,
    reachedAt: index <= currentIndex ? (reachedAt(step.key)?.toISOString() ?? null) : null,
  }));

  const closed = order.status === 'CANCELLED' ? 'CANCELLED' : order.status === 'REFUNDED' ? 'REFUNDED' : null;
  return { steps, currentStage, closed };
}

// ── Carriers ──────────────────────────────────────────────────────────────────────────

export type CarrierKind = 'usps' | 'ups' | 'fedex' | 'other';

/** USPS, UPS or FedEx from whatever was typed or came from ShipStation ("usps", "stamps_com", "UPS Ground", "ups_walleted"). */
export function carrierKind(carrier?: string | null): CarrierKind {
  const text = (carrier ?? '').toLowerCase();
  if (/usps|stamps|postal/.test(text)) return 'usps';
  if (/(^|[^a-z])ups([^a-z]|$)/.test(text)) return 'ups';
  if (/fedex/.test(text)) return 'fedex';
  return 'other';
}

export function carrierLabel(carrier?: string | null) {
  const kind = carrierKind(carrier);
  if (kind === 'usps') return 'USPS';
  if (kind === 'ups') return 'UPS';
  if (kind === 'fedex') return 'FedEx';
  return (carrier ?? '').trim();
}

/** The carrier's own tracking page for a number, when we know where it is. */
export function carrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string) {
  const number = encodeURIComponent(trackingNumber);
  switch (carrierKind(carrier)) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${number}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?tracknumbers=${number}`;
    default:
      return null;
  }
}

/** The carrier codes ShipStation may know a carrier by (a ShipStation Postage USPS account is "stamps_com"). */
export function shipStationCarrierCodes(carrier: string | null | undefined): string[] {
  switch (carrierKind(carrier)) {
    case 'usps':
      return ['stamps_com', 'usps'];
    case 'ups':
      return ['ups', 'ups_walleted'];
    case 'fedex':
      return ['fedex', 'fedex_walleted'];
    default:
      return [];
  }
}

/** A tracking number as typed: letters, digits, spaces and dashes only, tidied up. */
export function normalizeTrackingNumber(value: string) {
  return value.trim().replace(/\s+/g, '');
}

export const TRACKING_NUMBER_PATTERN = /^[A-Za-z0-9-]{5,60}$/;

// ── What the carrier says ─────────────────────────────────────────────────────────────

export interface LiveTrackingEvent {
  at: string | null;
  description: string;
  location: string;
}

export interface LiveTracking {
  statusCode: string;
  statusLabel: string;
  delivered: boolean;
  exception: boolean;
  estimatedDelivery: string | null;
  deliveredAt: string | null;
  /** Newest first. */
  events: LiveTrackingEvent[];
}

const STATUS_LABELS: Record<string, string> = {
  UN: 'No tracking information yet',
  NY: 'Label created; the carrier has not received the package yet',
  AC: 'Accepted by the carrier',
  IT: 'In transit',
  AT: 'Delivery attempted',
  DE: 'Delivered',
  EX: 'Delivery exception',
  SP: 'Delivered to a pickup location',
};

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const asDate = (value: unknown) => {
  const text = asText(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/** Reads ShipStation's tracking answer (status code, status text, estimated and actual delivery, and the list of events). */
export function mapTrackingResponse(json: unknown): LiveTracking | null {
  if (!json || typeof json !== 'object') return null;
  const source = json as Record<string, unknown>;
  const statusCode = asText(source.status_code).toUpperCase() || 'UN';
  const events = (Array.isArray(source.events) ? source.events : [])
    .map((entry): LiveTrackingEvent | null => {
      if (!entry || typeof entry !== 'object') return null;
      const event = entry as Record<string, unknown>;
      const description = asText(event.description) || asText(event.carrier_detail_code);
      if (!description) return null;
      const location = [asText(event.city_locality), asText(event.state_province), asText(event.country_code)]
        .filter(Boolean)
        .join(', ');
      return { at: asDate(event.occurred_at) ?? asDate(event.carrier_occurred_at), description, location };
    })
    .filter((event): event is LiveTrackingEvent => event !== null)
    .sort((a, b) => (Date.parse(b.at ?? '') || 0) - (Date.parse(a.at ?? '') || 0))
    .slice(0, 40);

  return {
    statusCode,
    statusLabel: asText(source.carrier_status_description) || asText(source.status_description) || STATUS_LABELS[statusCode] || 'In transit',
    delivered: statusCode === 'DE',
    exception: statusCode === 'EX',
    estimatedDelivery: asDate(source.estimated_delivery_date),
    deliveredAt: asDate(source.actual_delivery_date),
    events,
  };
}
