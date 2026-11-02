'use client';

import { useEffect, useState } from 'react';
import { cleanOrderPrefix, formatOrderNumber } from '@pl-cms/shared';

let cachedPrefix: string | null = null;
let pending: Promise<string> | null = null;

/** The store's order prefix (Store settings → Order Prefix), asked for once and remembered while the page is open. */
function loadOrderPrefix(): Promise<string> {
  if (cachedPrefix !== null) return Promise.resolve(cachedPrefix);
  pending ??= fetch('/api/proxy/store/ecommerce')
    .then((res) => (res.ok ? (res.json() as Promise<{ orderPrefix?: unknown }>) : null))
    .then((data) => cleanOrderPrefix(data?.orderPrefix))
    .catch(() => cleanOrderPrefix(undefined))
    .then((prefix) => {
      cachedPrefix = prefix;
      return prefix;
    });
  return pending;
}

/**
 * Turns an order's stored number into the one customers see (PL-1042). Orders from the API carry `orderNumber`;
 * until the prefix has loaded, and for an order without a number, the label falls back to the plain number or the short id.
 */
export function useOrderLabel(): (order: { id: string; orderNumber?: number | null }) => string {
  const [prefix, setPrefix] = useState(cachedPrefix ?? cleanOrderPrefix(undefined));
  useEffect(() => {
    let cancelled = false;
    void loadOrderPrefix().then((value) => {
      if (!cancelled) setPrefix(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (order) => (typeof order.orderNumber === 'number' ? formatOrderNumber(order.orderNumber, prefix) : order.id.slice(0, 12));
}

/** The number shown to customers, used to open an order's tracking page. */
export function trackingHref(label: string) {
  return `/track-order?order=${encodeURIComponent(label)}`;
}
