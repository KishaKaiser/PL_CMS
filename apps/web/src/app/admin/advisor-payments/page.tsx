'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

interface AdvisorRow {
  advisorId: string;
  displayName: string;
  sharePercentOverride: number | null;
  sharePercent: number;
  calls: number;
  chargedCents: number;
  earnedCents: number;
  paidCents: number;
  owedCents: number;
  payoutMethod: 'PAYPAL' | 'DIRECT_DEPOSIT';
  payoutSummary: string;
  payoutReady: boolean;
}

interface Overview {
  defaultSharePercent: number;
  totals: { chargedCents: number; earnedCents: number; paidCents: number; owedCents: number };
  advisors: AdvisorRow[];
}

interface Detail {
  advisorId: string;
  displayName: string;
  sharePercentOverride: number | null;
  sharePercent: number;
  earnedCents: number;
  paidCents: number;
  owedCents: number;
  payout: { method: 'PAYPAL' | 'DIRECT_DEPOSIT'; summary: string; paypalEmail: string | null; bankOnFile: boolean; bankOnFileAt: string | null };
  payouts: { id: string; amountCents: number; method: string; reference: string | null; note: string | null; paidAt: string }[];
  recentEarnings: { id: string; at: string; client: string; billedMinutes: number; freeMinutes: number; chargedCents: number; sharePercent: number; earnedCents: number }[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

export default function AdminAdvisorPaymentsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [defaultShare, setDefaultShare] = useState('50');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [shareInput, setShareInput] = useState('');
  const [pay, setPay] = useState({ amount: '', reference: '', note: '', paidAt: today() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/proxy/admin/payouts');
      if (!res.ok) throw new Error(await readMessage(res, 'Unable to load advisor payments'));
      const data = (await res.json()) as Overview;
      setOverview(data);
      setDefaultShare(String(data.defaultSharePercent));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load advisor payments');
    }
  }, []);

  const loadDetail = useCallback(async (advisorId: string) => {
    try {
      const res = await fetch(`/api/proxy/admin/payouts/advisors/${advisorId}`);
      if (!res.ok) throw new Error(await readMessage(res, 'Unable to load this advisor'));
      const data = (await res.json()) as Detail;
      setDetail(data);
      setShareInput(data.sharePercentOverride === null ? '' : String(data.sharePercentOverride));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this advisor');
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  async function send(path: string, method: string, body: unknown, done: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/admin/payouts${path}`, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'That did not work'));
      setMessage(done);
      await loadOverview();
      if (selected) await loadDetail(selected);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function saveDefault(event: FormEvent) {
    event.preventDefault();
    void send('/settings/share', 'PUT', { sharePercent: Number(defaultShare) }, 'Default share saved. It applies to calls that end from now on.');
  }

  function saveAdvisorShare(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const blank = shareInput.trim() === '';
    void send(`/advisors/${detail.advisorId}/share`, 'PATCH', { sharePercent: blank ? null : Number(shareInput) }, blank ? 'This advisor now follows the default share.' : 'Share saved. It applies to calls that end from now on.');
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const amountCents = Math.round(Number(pay.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      setError('Enter the amount you paid.');
      return;
    }
    const ok = await send(
      `/advisors/${detail.advisorId}/payouts`,
      'POST',
      { amountCents, ...(pay.reference.trim() ? { reference: pay.reference.trim() } : {}), ...(pay.note.trim() ? { note: pay.note.trim() } : {}), paidAt: new Date(`${pay.paidAt}T12:00:00`).toISOString() },
      `Recorded a payment of ${money(amountCents)} to ${detail.displayName}.`,
    );
    if (ok) setPay({ amount: '', reference: '', note: '', paidAt: today() });
  }

  function removePayment(id: string, amountCents: number) {
    if (!window.confirm(`Remove this ${money(amountCents)} payment? It will count as owed to the advisor again.`)) return;
    void send(`/payouts/${id}`, 'DELETE', null, 'Payment removed.');
  }

  const field = 'mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm';

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Advisor payments</h1>
        <p className="mt-1 text-sm text-gray-600">
          Advisors earn a share of what clients are charged for each call. You pay them yourself, then record the payment here. Free
          minutes earn nothing.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      {overview && (
        <>
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Default advisor share</h2>
            <p className="mt-1 text-sm text-gray-600">
              The percentage of each paid minute an advisor earns. You can give an individual advisor a different share below. A change
              only affects calls that end from then on; calls already recorded keep the share they were made at.
            </p>
            <form onSubmit={saveDefault} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block text-sm font-medium text-gray-700">
                Advisor share (%)
                <input type="number" min={0} max={100} step={1} value={defaultShare} onChange={(event) => setDefaultShare(event.target.value)} required className={`${field} w-32`} />
              </label>
              <button type="submit" disabled={busy} className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
                Save
              </button>
            </form>
          </section>

          <section className="grid gap-4 sm:grid-cols-4">
            {[
              ['Clients paid', overview.totals.chargedCents],
              ['Advisors earned', overview.totals.earnedCents],
              ['Paid out', overview.totals.paidCents],
              ['Owed to advisors', overview.totals.owedCents],
            ].map(([label, cents]) => (
              <div key={label as string} className="rounded-lg border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold">{money(cents as number)}</p>
              </div>
            ))}
          </section>

          <section className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Advisor</th>
                  <th className="px-4 py-3 text-right">Share</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Earned</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Owed</th>
                  <th className="px-4 py-3">Paid by</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overview.advisors.map((row) => (
                  <tr
                    key={row.advisorId}
                    onClick={() => setSelected(row.advisorId === selected ? null : row.advisorId)}
                    className={`cursor-pointer hover:bg-gray-50 ${row.advisorId === selected ? 'bg-purple-50' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{row.displayName}</td>
                    <td className="px-4 py-3 text-right">
                      {row.sharePercent}%{row.sharePercentOverride !== null && <span className="ml-1 text-xs text-gray-500">(custom)</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{row.calls}</td>
                    <td className="px-4 py-3 text-right">{money(row.earnedCents)}</td>
                    <td className="px-4 py-3 text-right">{money(row.paidCents)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${row.owedCents > 0 ? 'text-amber-700' : ''}`}>{money(row.owedCents)}</td>
                    <td className="px-4 py-3">{row.payoutReady ? row.payoutSummary : <span className="text-amber-700">{row.payoutSummary}</span>}</td>
                  </tr>
                ))}
                {overview.advisors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-gray-500">
                      No advisors yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}

      {detail && (
        <section className="space-y-6 rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{detail.displayName}</h2>
              <p className="text-sm text-gray-600">
                Earned {money(detail.earnedCents)} · paid {money(detail.paidCents)} ·{' '}
                <span className="font-semibold text-amber-700">owed {money(detail.owedCents)}</span>
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
              Close
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">How to pay them</h3>
              <div className="mt-2 rounded border p-3 text-sm">
                <p className="font-medium">{detail.payout.method === 'DIRECT_DEPOSIT' ? 'Direct Deposit' : 'PayPal'}</p>
                {detail.payout.method === 'PAYPAL' ? (
                  <p className="text-gray-900">{detail.payout.paypalEmail ?? <span className="text-amber-700">They have not given a PayPal email yet.</span>}</p>
                ) : (
                  <p className="text-gray-700">Pay them with the bank information they gave Support during onboarding. It is not stored on this site.</p>
                )}
                <p className="mt-2 text-xs text-gray-500">This follows whatever the advisor last chose in their dashboard, so there is nothing to update here.</p>
              </div>

              <div className="mt-3 rounded border p-3 text-sm">
                <p className="font-medium">Bank information from onboarding</p>
                <p className="text-gray-700">
                  {detail.payout.bankOnFile
                    ? `Marked as received${detail.payout.bankOnFileAt ? ` on ${new Date(detail.payout.bankOnFileAt).toLocaleDateString()}` : ''}. The advisor can choose Direct Deposit.`
                    : 'Not received. Direct Deposit is greyed out for this advisor until you mark it received.'}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send(`/advisors/${detail.advisorId}/bank-on-file`, 'PUT', { onFile: !detail.payout.bankOnFile }, detail.payout.bankOnFile ? 'Bank information cleared. This advisor is paid by PayPal.' : 'Marked as received. The advisor can now choose Direct Deposit.')}
                  className="mt-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {detail.payout.bankOnFile ? 'Clear: no longer on file' : 'Mark bank information received'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={saveAdvisorShare}>
                <h3 className="font-semibold">Advisor share</h3>
                <p className="text-xs text-gray-500">Currently {detail.sharePercent}%. Leave empty to follow the default ({overview?.defaultSharePercent}%).</p>
                <div className="mt-2 flex items-end gap-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Custom share (%)
                    <input type="number" min={0} max={100} step={1} value={shareInput} onChange={(event) => setShareInput(event.target.value)} className={`${field} w-32`} />
                  </label>
                  <button type="submit" disabled={busy} className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
                    Save
                  </button>
                </div>
              </form>

              <form onSubmit={recordPayment} className="space-y-3">
                <h3 className="font-semibold">Record a payment</h3>
                <p className="text-xs text-gray-500">Pay them first (PayPal, bank, etc.), then record it here. Up to what they are owed.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Amount paid ($)
                    <input type="number" min={0.01} step={0.01} value={pay.amount} onChange={(event) => setPay({ ...pay, amount: event.target.value })} required className={field} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    Date paid
                    <input type="date" value={pay.paidAt} max={today()} onChange={(event) => setPay({ ...pay, paidAt: event.target.value })} required className={field} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                    Reference (transaction ID)
                    <input value={pay.reference} onChange={(event) => setPay({ ...pay, reference: event.target.value })} maxLength={120} className={field} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
                    Note
                    <input value={pay.note} onChange={(event) => setPay({ ...pay, note: event.target.value })} maxLength={500} className={field} />
                  </label>
                </div>
                <button type="submit" disabled={busy || detail.owedCents <= 0} className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
                  Record payment
                </button>
              </form>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Payments made</h3>
            <ul className="mt-2 divide-y rounded border">
              {detail.payouts.map((payout) => (
                <li key={payout.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{money(payout.amountCents)}</span>
                    <span className="text-gray-500"> · {payout.method}</span>
                    {payout.reference && <span className="text-gray-500"> · ref {payout.reference}</span>}
                    {payout.note && <span className="text-gray-500"> · {payout.note}</span>}
                  </span>
                  <span className="flex items-center gap-3 text-gray-500">
                    {new Date(payout.paidAt).toLocaleDateString()}
                    <button type="button" onClick={() => removePayment(payout.id, payout.amountCents)} disabled={busy} className="text-red-700 underline disabled:opacity-50">
                      Remove
                    </button>
                  </span>
                </li>
              ))}
              {detail.payouts.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">No payments recorded yet.</li>}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Recent calls</h3>
            <div className="mt-2 overflow-x-auto rounded border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2 text-right">Minutes</th>
                    <th className="px-3 py-2 text-right">Client paid</th>
                    <th className="px-3 py-2 text-right">Share</th>
                    <th className="px-3 py-2 text-right">Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detail.recentEarnings.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-3 py-2">{new Date(row.at).toLocaleString()}</td>
                      <td className="px-3 py-2">{row.client}</td>
                      <td className="px-3 py-2 text-right">
                        {row.billedMinutes}
                        {row.freeMinutes > 0 && <span className="ml-1 text-xs text-green-700">({row.freeMinutes} free)</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{money(row.chargedCents)}</td>
                      <td className="px-3 py-2 text-right">{row.sharePercent}%</td>
                      <td className="px-3 py-2 text-right font-semibold">{money(row.earnedCents)}</td>
                    </tr>
                  ))}
                  {detail.recentEarnings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-gray-500">
                        No paid calls yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
