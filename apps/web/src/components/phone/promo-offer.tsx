'use client';

import { useEffect, useState } from 'react';
import { siteButtonStyle } from '../../lib/site-button';
import { readMessage } from './phone-format';

interface Offer {
  status: 'unavailable' | 'available' | 'claimed' | 'blocked';
  priceCents: number;
  minutes: number;
  expiresInDays: number | null;
  message: string | null;
}

const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The new customer promotion: promotional minutes for a small price, paid with PayPal. Shown only to a signed-in client who
 * can still claim it (or who is told why they cannot, when their internet connection already claimed it); nothing otherwise.
 */
export function PromoOffer({ className = '' }: { className?: string }) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/proxy/free-minutes/promo/offer')
      .then((res) => (res.ok ? (res.json() as Promise<Offer>) : null))
      .then(setOffer)
      .catch(() => setOffer(null));
  }, []);

  if (!offer || (offer.status !== 'available' && offer.status !== 'blocked')) return null;

  async function claim() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/free-minutes/promo/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ returnOrigin: window.location.origin }),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'Could not start the payment. Please try again.'));
      const { approvalUrl } = (await res.json()) as { approvalUrl: string };
      if (!approvalUrl) throw new Error('PayPal did not return a payment page. Please try again.');
      window.location.href = approvalUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the payment. Please try again.');
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-2xl border border-amber-200 bg-amber-50 p-6 ${className}`} aria-label="New customer offer">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">New customer offer</p>
      <h2 className="mt-1 text-2xl font-bold text-gray-950">
        {offer.minutes} minutes for {price(offer.priceCents)}
      </h2>
      {offer.status === 'available' ? (
        <>
          <p className="mt-2 text-sm text-gray-700">
            Try a reading with any advisor. The minutes are used before your wallet is charged
            {offer.expiresInDays ? ` and last ${offer.expiresInDays} days` : ''}. The offer can be claimed once per customer.
          </p>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="site-button-colors mt-4 rounded-lg px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={siteButtonStyle('#7445ad', '#63379c')}
          >
            {busy ? 'Opening PayPal…' : `Claim for ${price(offer.priceCents)} with PayPal`}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-700">{offer.message}</p>
      )}
    </section>
  );
}
