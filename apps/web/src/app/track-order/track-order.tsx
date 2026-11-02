'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { TrackingDetails } from '../../components/order-tracking-details';
import type { OrderTracking } from '../../lib/order-tracking';
import { siteButtonStyle } from '../../lib/site-button';

type Lookup = { order: string; email?: string; token?: string };

/**
 * "Where is my order?" on its own page. The order number comes from the address (?order=PL-1042, from the dashboard or an order
 * email) or is typed in. A signed-in customer's own order, and a link from an order email, open straight away; anyone else
 * also types the email address used for the order.
 */
export function TrackOrder({ signedIn, linkedOrder, linkToken }: { signedIn: boolean; linkedOrder: string; linkToken: string }) {
  // A link that can be opened without asking for anything more starts out "opening", so the form does not flash first.
  const opensItself = Boolean(linkedOrder && (linkToken || signedIn));
  const [order, setOrder] = useState(linkedOrder);
  const [email, setEmail] = useState('');
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(opensItself);
  const [opening, setOpening] = useState(opensItself);
  const [error, setError] = useState('');
  const link = useRef({ order: linkedOrder.toLowerCase(), token: linkToken });

  const latest = useRef(0);
  const started = useRef(false);

  const lookup = useCallback(async (request: Lookup) => {
    const mine = ++latest.current;
    const current = () => mine === latest.current;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (res.status === 429) throw new Error('Too many tries. Please wait a minute and try again.');
      if (res.status === 404 || res.status === 400) {
        const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
        throw new Error(
          res.status === 404 && typeof body?.message === 'string'
            ? body.message
            : 'Enter the order number from your confirmation email, for example PL-1042.',
        );
      }
      if (!res.ok) throw new Error('We could not load the tracking for this order. Please try again.');
      const data = (await res.json()) as OrderTracking;
      // An older request that answers late must not overwrite a newer one.
      if (current()) {
        setTracking(data);
        setOrder(data.orderLabel);
      }
      return true;
    } catch (err: unknown) {
      if (current()) {
        setTracking(null);
        setError(err instanceof Error ? err.message : 'We could not load the tracking for this order. Please try again.');
      }
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  // A link with the order number in it (from the dashboard or an email) opens it straight away when we can prove whose it is.
  // When it is not theirs, or the link is no longer valid, the form stays with the number filled in and asks for the email.
  useEffect(() => {
    if (!opensItself || started.current) return;
    started.current = true;
    void lookup({ order: linkedOrder, ...(linkToken ? { token: linkToken } : {}) }).then((found) => {
      if (!found) setError('');
      setOpening(false);
    });
  }, [lookup, opensItself, linkedOrder, linkToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const request: Lookup = { order: order.trim() };
    if (email.trim()) request.email = email.trim();
    // The signed link only opens the order it was made for.
    if (link.current.token && request.order.toLowerCase() === link.current.order) request.token = link.current.token;
    await lookup(request);
  }

  function reset() {
    latest.current++;
    setLoading(false);
    setOpening(false);
    link.current = { order: '', token: '' };
    setTracking(null);
    setError('');
    setOrder('');
    setEmail('');
    window.history.replaceState(null, '', '/track-order');
  }

  return (
    <main className="min-h-[calc(100vh-96px)] bg-[radial-gradient(circle_at_top_left,#fff3dc_0,#fff7ed_26%,#faf5ff_72%,#ffffff_100%)] px-4 py-10 sm:px-8 lg:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#2d155f]">Track your order</h1>

        {opening && !tracking ? (
          <p role="status" className="mt-8 text-center text-gray-500">
            Looking for your order…
          </p>
        ) : tracking ? (
          <div className="mt-8">
            <TrackingDetails tracking={tracking} />
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
              <button type="button" onClick={reset} className="font-medium text-purple-700 hover:underline">
                Track another order
              </button>
              {signedIn && (
                <Link href="/client/orders" className="font-medium text-purple-700 hover:underline">
                  My orders
                </Link>
              )}
            </div>
          </div>
        ) : (
          <section className="mx-auto mt-6 max-w-md rounded-3xl bg-white p-8 shadow-2xl shadow-purple-950/10 sm:p-10">
            <form onSubmit={submit} className="space-y-4">
              <p className="text-center text-sm text-gray-500">
                Enter your order number to see where your order is. You can find it in your order confirmation email
                {signedIn ? ' and under My orders' : ''}.
              </p>
              {loading && !error && (
                <p role="status" className="text-center text-sm text-gray-500">
                  Looking for your order…
                </p>
              )}
              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="order-number" className="mb-2 block text-sm font-medium text-gray-900">
                  Order number
                </label>
                <input
                  id="order-number"
                  type="text"
                  required
                  maxLength={60}
                  autoComplete="off"
                  placeholder="PL-1042"
                  value={order}
                  onChange={(event) => setOrder(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              <div>
                <label htmlFor="order-email" className="mb-2 block text-sm font-medium text-gray-900">
                  Email address used for the order{' '}
                  {signedIn && <span className="font-normal text-gray-500">(not needed for your own orders)</span>}
                </label>
                <input
                  id="order-email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="site-button-colors h-12 w-full rounded-xl text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={siteButtonStyle('#7445ad', '#63379c')}
              >
                {loading ? 'Looking…' : 'Track order'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
