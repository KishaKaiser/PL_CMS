'use client';

import { useCallback, useEffect, useState } from 'react';

interface EarningRow {
  id: string;
  at: string;
  client: string;
  billedMinutes: number;
  freeMinutes: number;
  chargedCents: number;
  sharePercent: number;
  earnedCents: number;
}

interface Overview {
  timeZone: string;
  sharePercent: number;
  method: 'PAYPAL' | 'DIRECT_DEPOSIT';
  paypalFeePercent: number;
  directDepositFeePercent: number;
  summary: { last7DaysCents: number; thisMonthCents: number; allTimeCents: number; paidCents: number; owedCents: number; owedAfterFeeCents: number };
  earnings: { page: number; pageSize: number; total: number; rows: EarningRow[] };
  payouts: { id: string; amountCents: number; feeCents: number; netCents: number; method: string; reference: string | null; paidAt: string }[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** An advisor's earnings: totals, what they are owed, a breakdown of each call and the payments they have received. */
export function AdvisorEarnings() {
  const [data, setData] = useState<Overview | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/proxy/payouts/me?tz=${encodeURIComponent(zone)}&page=${page}`);
      if (!res.ok) throw new Error('Unable to load your earnings');
      setData((await res.json()) as Overview);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your earnings');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading your earnings…</p>;

  const { summary } = data;
  const feePercent = data.method === 'PAYPAL' ? data.paypalFeePercent : data.directDepositFeePercent;
  const pages = Math.max(1, Math.ceil(data.earnings.total / data.earnings.pageSize));
  const cards = [
    { label: 'Last 7 days', value: summary.last7DaysCents },
    { label: 'This month', value: summary.thisMonthCents },
    { label: 'All time', value: summary.allTimeCents },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-purple-50 p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Waiting to be paid</p>
        <p className="mt-2 text-4xl font-bold text-gray-950">{money(summary.owedCents)}</p>
        <p className="mt-2 text-sm text-gray-600">
          You have earned {money(summary.allTimeCents)} and been paid {money(summary.paidCents)}. You earn {data.sharePercent}% of what clients
          pay for each minute. Free minutes do not earn anything.
        </p>
        {summary.owedCents > 0 && feePercent > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            You are paid by {data.method === 'PAYPAL' ? 'PayPal' : 'Direct Deposit'}, which has a {feePercent}% fee taken from each payment, so
            you would receive about <span className="font-semibold">{money(summary.owedAfterFeeCents)}</span> of this.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-950">{money(card.value)}</p>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Your calls</h3>
        {data.earnings.rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-gray-500">Your earnings appear here after your first paid call.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Minutes</th>
                  <th className="px-4 py-3 text-right">Client paid</th>
                  <th className="px-4 py-3 text-right">Your share</th>
                  <th className="px-4 py-3 text-right">You earned</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.earnings.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(row.at).toLocaleString()}</td>
                    <td className="px-4 py-3">{row.client}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {row.billedMinutes}
                      {row.freeMinutes > 0 && <span className="ml-1 text-xs text-green-700">({row.freeMinutes} free)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{money(row.chargedCents)}</td>
                    <td className="px-4 py-3 text-right">{row.sharePercent}%</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(row.earnedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">
              Newer
            </button>
            <span className="text-gray-500">
              Page {page} of {pages}
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">
              Older
            </button>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-gray-900">Payments you have received</h3>
        {data.payouts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-gray-500">No payments yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-white">
            {data.payouts.map((payout) => (
              <li key={payout.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{money(payout.netCents)}</span>
                  {payout.feeCents > 0 && (
                    <span className="text-gray-500">
                      {' '}
                      ({money(payout.amountCents)} less a {money(payout.feeCents)} fee)
                    </span>
                  )}
                  <span className="text-gray-500"> · {payout.method}</span>
                  {payout.reference && <span className="text-gray-500"> · ref {payout.reference}</span>}
                </span>
                <span className="text-gray-500">{new Date(payout.paidAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
