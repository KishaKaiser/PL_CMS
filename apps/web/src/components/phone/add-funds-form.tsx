'use client';

import { useEffect, useState } from 'react';
import { addToCart, removeFromCart } from '../../lib/cart';

const PRESET_DOLLARS = [10, 25, 50, 100];
const MIN_DOLLARS = 5;
const MAX_DOLLARS = 500;

interface CreditProduct {
  id: string;
  name: string;
  price: number | string;
  currency: string;
}

export function AddFundsForm({ primaryColor }: { primaryColor: string }) {
  const [amountInput, setAmountInput] = useState('25');
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // The phone page links here with the amount the client is short by.
    const suggested = Number(new URLSearchParams(window.location.search).get('amount'));
    if (Number.isInteger(suggested) && suggested >= MIN_DOLLARS && suggested <= MAX_DOLLARS) {
      setAmountInput(String(suggested));
    }

    fetch('/api/proxy/phone/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ balanceCents: number }>) : null))
      .then((profile) => setBalanceCents(profile ? profile.balanceCents : null))
      .catch(() => setBalanceCents(null));
  }, []);

  const dollars = Number(amountInput);
  const amountValid = amountInput.trim() !== '' && Number.isInteger(dollars) && dollars >= MIN_DOLLARS && dollars <= MAX_DOLLARS;

  async function handleContinue() {
    if (!amountValid) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/wallet/credit-product');
      if (res.status === 401 || res.status === 403) {
        window.location.href = `/login?next=${encodeURIComponent('/client/shop')}`;
        return;
      }
      if (!res.ok) throw new Error('Could not start checkout. Please try again.');

      const product = (await res.json()) as CreditProduct;
      const unitPrice = Number(product.price);
      // Each unit adds its price to the wallet, so the quantity is how many units make up the amount.
      const quantity = Math.round(dollars / unitPrice);

      // Replace any earlier wallet line so the amount is exactly what was typed.
      removeFromCart(product.id);
      addToCart({
        productId: product.id,
        productName: product.name,
        productPrice: unitPrice,
        productType: 'MINUTE_PACK',
        currency: product.currency,
        quantity,
      });
      window.location.href = '/shop/checkout';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-sm">
      {balanceCents !== null && (
        <p className="mb-5 text-center text-sm text-gray-600">
          Current wallet balance: <span className="font-semibold">${(balanceCents / 100).toFixed(2)}</span>
        </p>
      )}

      <p className="text-sm font-medium text-gray-700">How much would you like to add?</p>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {PRESET_DOLLARS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmountInput(String(preset))}
            className="rounded-lg border py-2 text-sm font-semibold hover:bg-gray-50"
            style={dollars === preset ? { borderColor: primaryColor, color: primaryColor, backgroundColor: 'rgba(0,0,0,0.03)' } : undefined}
          >
            ${preset}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-medium text-gray-700">
        Or enter an amount
        <div className="mt-1 flex items-center rounded border px-3">
          <span className="text-gray-500">$</span>
          <input
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            className="w-full px-2 py-2 text-sm outline-none"
            aria-label="Amount in dollars"
          />
        </div>
      </label>
      <p className="mt-1 text-xs text-gray-500">
        Whole dollars, ${MIN_DOLLARS} to ${MAX_DOLLARS}. You are only charged for the minutes you talk.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={!amountValid || busy}
        className="mt-5 w-full rounded-lg py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {busy ? 'Starting checkout…' : amountValid ? `Add $${dollars} to wallet` : 'Enter an amount'}
      </button>
    </div>
  );
}
