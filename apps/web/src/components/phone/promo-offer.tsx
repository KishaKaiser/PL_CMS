'use client';

import { useEffect, useState } from 'react';
import { addToCart, getCart, removeFromCart } from '../../lib/cart';
import { siteButtonStyle } from '../../lib/site-button';
import { readMessage } from './phone-format';

interface Offer {
  status: 'unavailable' | 'available' | 'claimed' | 'blocked';
  priceCents: number;
  minutes: number;
  expiresInDays: number | null;
  message: string | null;
}

interface PromoProduct {
  id: string;
  name: string;
  price: number | string;
  currency: string;
}

const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * The new customer promotion: promotional minutes for a small price, bought through the store checkout like adding money to the
 * wallet. Shown only to a signed-in client who can still claim it (or who is told why they cannot, when their internet
 * connection already claimed it); nothing otherwise.
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
      const res = await fetch('/api/proxy/free-minutes/promo/product');
      if (!res.ok) throw new Error(await readMessage(res, 'Could not start checkout. Please try again.'));
      const product = (await res.json()) as PromoProduct;

      // The offer is bought on its own, so other things in the cart have to be checked out (or removed) first.
      if (getCart().some((item) => item.productId !== product.id)) {
        throw new Error('Your cart has other items in it. Check out or remove them first, then claim this offer.');
      }
      removeFromCart(product.id);
      addToCart({
        productId: product.id,
        productName: product.name,
        productPrice: Number(product.price),
        productType: 'MINUTE_PACK',
        currency: product.currency,
        quantity: 1,
      });
      window.location.href = '/shop/checkout';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
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
            {busy ? 'Opening checkout…' : `Claim for ${price(offer.priceCents)}`}
          </button>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-700">{offer.message}</p>
      )}
    </section>
  );
}
