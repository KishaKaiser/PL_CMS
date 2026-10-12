'use client';

import { useEffect, useState } from 'react';

interface WalletPack {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  minutesPack: number;
  isActive?: boolean;
}

/** Store products with a minutes-pack value above 0 are the ones that credit the wallet when paid. */
export function AddFundsPacks({ primaryColor }: { primaryColor: string }) {
  const [packs, setPacks] = useState<WalletPack[] | null>(null);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/proxy/products')
      .then((res) => {
        if (!res.ok) throw new Error('Could not load wallet packs');
        return res.json() as Promise<WalletPack[]>;
      })
      .then((products) =>
        setPacks(
          (Array.isArray(products) ? products : [])
            .filter((product) => product.minutesPack > 0 && product.isActive !== false)
            .sort((a, b) => Number(a.price) - Number(b.price)),
        ),
      )
      .catch((err: unknown) => {
        setPacks([]);
        setError(err instanceof Error ? err.message : 'Could not load wallet packs');
      });

    fetch('/api/proxy/phone/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ balanceCents: number }>) : null))
      .then((profile) => setBalanceCents(profile ? profile.balanceCents : null))
      .catch(() => setBalanceCents(null));
  }, []);

  return (
    <div>
      {balanceCents !== null && (
        <p className="mb-6 text-center text-sm text-gray-600">
          Current wallet balance: <span className="font-semibold">${(balanceCents / 100).toFixed(2)}</span>
        </p>
      )}

      {error && <p className="mb-4 text-center text-sm text-red-600">{error}</p>}
      {packs === null && !error && <p className="text-center text-gray-500">Loading…</p>}

      {packs !== null && packs.length === 0 && !error && (
        <p className="text-center text-gray-500">
          No wallet packs are available yet. An admin can add one under Products by giving it a minutes-pack value above 0.
        </p>
      )}

      {packs !== null && packs.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <li key={pack.id} className="flex flex-col rounded-xl border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">{pack.name}</h2>
              {pack.description && <p className="mt-1 text-sm text-gray-500">{pack.description}</p>}
              <p className="mt-4 text-3xl font-bold" style={{ color: primaryColor }}>
                ${Number(pack.price).toFixed(2)}
              </p>
              <p className="mt-1 text-sm font-medium text-green-700">
                Adds ${Number(pack.price).toFixed(2)} to your wallet
              </p>
              <a
                href={`/shop/${pack.id}`}
                className="mt-auto block rounded-lg py-3 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor, marginTop: '1.25rem' }}
              >
                Add Funds
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
