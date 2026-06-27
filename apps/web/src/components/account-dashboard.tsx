'use client';

import type { ReactNode } from 'react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type DashboardMode = 'client' | 'advisor';

interface DashboardUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface DashboardOrder {
  id: string;
  status: string;
  totalAmount: number | string;
  currency: string;
  createdAt: string;
  shippingAddress?: { fullName: string; city: string; state: string } | null;
  items: { id: string; quantity: number; product: { name: string } }[];
}

interface AccountAddress {
  id: string;
  label: string;
  fullName: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface PaymentMethod {
  id: string;
  label: string;
  provider: string;
  brand?: string | null;
  last4?: string | null;
  isDefault: boolean;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number | string;
  currency: string;
  minutesDelta?: number | null;
  description?: string | null;
  createdAt: string;
}

interface AdvisorProfile {
  id: string;
  displayName: string;
  bio?: string | null;
  ratePerMinute: number | string;
  isOnline: boolean;
}

interface PayoutMethod {
  id: string;
  label: string;
  methodType: string;
  accountName: string;
  isDefault: boolean;
}

interface CallTransaction {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  billedMinutes?: number | null;
  client?: { user?: { name: string; email: string } };
}

interface DashboardData {
  user: DashboardUser;
  orders: DashboardOrder[];
  addresses: AccountAddress[];
  paymentMethods: PaymentMethod[];
  wallet: {
    balanceMinutes: number | null;
    transactions: WalletTransaction[];
  };
  messages: { unreadCount: number };
  advisor: null | {
    profile: AdvisorProfile;
    payoutMethods: PayoutMethod[];
    callTransactions: CallTransaction[];
  };
}

const emptyAddress = {
  label: '',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
  isDefault: false,
};

const emptyPaymentMethod = {
  label: '',
  provider: 'PayPal',
  brand: '',
  last4: '',
  isDefault: false,
};

const emptyPayoutMethod = {
  label: '',
  methodType: 'PayPal',
  accountName: '',
  details: '',
  isDefault: false,
};

export function AccountDashboard({ mode }: { mode: DashboardMode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountName, setAccountName] = useState('');
  const [addressForm, setAddressForm] = useState(emptyAddress);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentMethod);
  const [advisorForm, setAdvisorForm] = useState({
    displayName: '',
    bio: '',
    ratePerMinute: '0',
    isOnline: false,
  });
  const [payoutForm, setPayoutForm] = useState(emptyPayoutMethod);

  const isAdvisor = mode === 'advisor';
  const messagesHref = isAdvisor ? '/advisor/messages' : '/client/messages';

  const fetchDashboard = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/proxy/account/dashboard');
      if (!res.ok) throw new Error('Unable to load dashboard');
      const nextData = (await res.json()) as DashboardData;
      setData(nextData);
      setAccountName(nextData.user.name);
      if (nextData.advisor?.profile) {
        setAdvisorForm({
          displayName: nextData.advisor.profile.displayName,
          bio: nextData.advisor.profile.bio ?? '',
          ratePerMinute: String(nextData.advisor.profile.ratePerMinute ?? 0),
          isOnline: nextData.advisor.profile.isOnline,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const orderTotal = useMemo(
    () =>
      data?.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0) ?? 0,
    [data],
  );

  async function postJson(path: string, body: unknown, method = 'POST') {
    const res = await fetch(`/api/proxy/account/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const responseBody = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(responseBody?.message ?? 'Save failed');
    }
    return res.json();
  }

  async function handleAccountSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction('account', async () => {
      await postJson('me', { name: accountName }, 'PATCH');
      setSuccess('Account details saved.');
    });
  }

  async function handleAddressSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction('address', async () => {
      await postJson('addresses', addressForm);
      setAddressForm(emptyAddress);
      setSuccess('Address saved.');
    });
  }

  async function handlePaymentSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction('payment', async () => {
      await postJson('payment-methods', paymentForm);
      setPaymentForm(emptyPaymentMethod);
      setSuccess('Payment method saved.');
    });
  }

  async function handleAdvisorSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction('advisor', async () => {
      await postJson(
        'advisor-profile',
        {
          ...advisorForm,
          ratePerMinute: Number(advisorForm.ratePerMinute),
        },
        'PATCH',
      );
      setSuccess('Advisor profile saved.');
    });
  }

  async function handlePayoutSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveAction('payout', async () => {
      await postJson('payout-methods', {
        label: payoutForm.label,
        methodType: payoutForm.methodType,
        accountName: payoutForm.accountName,
        details: payoutForm.details ? { note: payoutForm.details } : {},
        isDefault: payoutForm.isDefault,
      });
      setPayoutForm(emptyPayoutMethod);
      setSuccess('Payout method saved.');
    });
  }

  async function saveAction(name: string, action: () => Promise<void>) {
    setSaving(name);
    setError('');
    setSuccess('');
    try {
      await action();
      await fetchDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving('');
    }
  }

  async function removeItem(path: string, successMessage: string) {
    await saveAction(path, async () => {
      const res = await fetch(`/api/proxy/account/${path}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      setSuccess(successMessage);
    });
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-7xl p-8">
        <div className="rounded-2xl border bg-white p-8 text-gray-500 shadow-sm">Loading dashboard...</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
          {error || 'Dashboard unavailable.'}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-8">
      <div className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-700">
              {isAdvisor ? 'Advisor workspace' : 'Client workspace'}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-gray-950">
              {isAdvisor ? 'Advisor Dashboard' : 'Client Dashboard'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Welcome back, {data.user.name}. Manage your account, wallet, orders, and messages.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={messagesHref}
              className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
            >
              Private Messages ({data.messages.unreadCount})
            </a>
            <a
              href="/shop"
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              Add Money
            </a>
          </div>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat label="Orders" value={data.orders.length.toString()} detail="Lifetime orders" />
        <SummaryStat label="Order Total" value={`$${orderTotal.toFixed(2)}`} detail="Total spent" />
        <SummaryStat
          label="Wallet Balance"
          value={
            data.wallet.balanceMinutes === null
              ? 'Not set'
              : `${data.wallet.balanceMinutes} min`
          }
          detail="Available call time"
        />
        <SummaryStat label="Unread Messages" value={data.messages.unreadCount.toString()} detail="Private inbox" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section className="space-y-6">
          <Panel title="Recent Orders" actionHref="/client/orders" actionLabel="View all">
            {data.orders.length === 0 ? (
              <EmptyText text="No orders have been placed yet." />
            ) : (
              <div className="divide-y">
                {data.orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-gray-500">
                          #{order.id.slice(0, 12)}
                        </div>
                        <div className="mt-1 text-sm text-gray-700">
                          {order.items.map((item) => item.product.name).join(', ') || 'Order'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">
                          {order.status}
                        </span>
                        <div className="mt-1 text-sm font-semibold">
                          ${Number(order.totalAmount).toFixed(2)} {order.currency}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Saved Addresses">
            <form onSubmit={handleAddressSave} className="grid gap-3 md:grid-cols-2">
              <Input label="Label" value={addressForm.label} onChange={(label) => setAddressForm((f) => ({ ...f, label }))} required />
              <Input label="Full name" value={addressForm.fullName} onChange={(fullName) => setAddressForm((f) => ({ ...f, fullName }))} required />
              <Input label="Phone" value={addressForm.phone} onChange={(phone) => setAddressForm((f) => ({ ...f, phone }))} />
              <Input label="Street address" value={addressForm.line1} onChange={(line1) => setAddressForm((f) => ({ ...f, line1 }))} required />
              <Input label="Address line 2" value={addressForm.line2} onChange={(line2) => setAddressForm((f) => ({ ...f, line2 }))} />
              <Input label="City" value={addressForm.city} onChange={(city) => setAddressForm((f) => ({ ...f, city }))} required />
              <Input label="State" value={addressForm.state} onChange={(state) => setAddressForm((f) => ({ ...f, state }))} required />
              <Input label="Postal code" value={addressForm.postalCode} onChange={(postalCode) => setAddressForm((f) => ({ ...f, postalCode }))} required />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(event) => setAddressForm((f) => ({ ...f, isDefault: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-purple-700"
                />
                Default address
              </label>
              <div className="md:col-span-2">
                <PrimaryButton disabled={saving === 'address'}>
                  Save Address
                </PrimaryButton>
              </div>
            </form>
            <ListBlock>
              {data.addresses.map((address) => (
                <div key={address.id} className="flex justify-between gap-3 py-4">
                  <div className="text-sm">
                    <div className="font-medium">
                      {address.label} {address.isDefault ? '(Default)' : ''}
                    </div>
                    <div className="text-gray-500">
                      {address.line1}, {address.city}, {address.state} {address.postalCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeItem(`addresses/${address.id}`, 'Address removed.')}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {data.addresses.length === 0 && <EmptyText text="No saved addresses yet." />}
            </ListBlock>
          </Panel>

          {isAdvisor && data.advisor && (
            <Panel title="Call Transactions">
              {data.advisor.callTransactions.length === 0 ? (
                <EmptyText text="No call transactions yet." />
              ) : (
                <div className="divide-y">
                  {data.advisor.callTransactions.map((call) => (
                    <div key={call.id} className="flex justify-between gap-3 py-4 text-sm">
                      <div>
                        <div className="font-medium">
                          {call.client?.user?.name ?? 'Client call'}
                        </div>
                        <div className="text-gray-500">
                          {new Date(call.startedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div>{call.status}</div>
                        <div className="text-gray-500">{call.billedMinutes ?? 0} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </section>

        <aside className="space-y-6">
          <Panel title="Account Details">
            <form onSubmit={handleAccountSave} className="space-y-3">
              <Input label="Name" value={accountName} onChange={setAccountName} required />
              <ReadOnly label="Email" value={data.user.email} />
              <ReadOnly label="Role" value={data.user.role} />
              <PrimaryButton disabled={saving === 'account'}>
                Save Account
              </PrimaryButton>
            </form>
          </Panel>

          <Panel title="Wallet">
            <div className="mb-4 rounded-xl bg-purple-50 p-4">
              <div className="text-xs font-medium uppercase text-gray-500">Current balance</div>
              <div className="mt-1 text-2xl font-semibold text-gray-950">
                {data.wallet.balanceMinutes === null
                  ? 'No wallet profile'
                  : `${data.wallet.balanceMinutes} minutes`}
              </div>
              <a href="/shop" className="mt-3 inline-block text-sm font-semibold text-purple-700 hover:text-purple-800">
                Add money to wallet
              </a>
            </div>
            {data.wallet.transactions.length === 0 ? (
              <EmptyText text="No wallet transactions yet." />
            ) : (
              <div className="divide-y">
                {data.wallet.transactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium">{transaction.type}</div>
                      <div className="text-gray-500">{transaction.description ?? transaction.currency}</div>
                    </div>
                    <div className="text-right">
                      <div>{transaction.minutesDelta ?? Number(transaction.amount)}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Payment Methods">
            <form onSubmit={handlePaymentSave} className="space-y-3">
              <Input label="Label" value={paymentForm.label} onChange={(label) => setPaymentForm((f) => ({ ...f, label }))} required />
              <Input label="Provider" value={paymentForm.provider} onChange={(provider) => setPaymentForm((f) => ({ ...f, provider }))} required />
              <Input label="Brand" value={paymentForm.brand} onChange={(brand) => setPaymentForm((f) => ({ ...f, brand }))} />
              <Input label="Last 4" value={paymentForm.last4} onChange={(last4) => setPaymentForm((f) => ({ ...f, last4 }))} />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={paymentForm.isDefault}
                  onChange={(event) => setPaymentForm((f) => ({ ...f, isDefault: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-purple-700"
                />
                Default payment method
              </label>
              <PrimaryButton disabled={saving === 'payment'}>
                Save Payment Method
              </PrimaryButton>
            </form>
            <ListBlock>
              {data.paymentMethods.map((method) => (
                <div key={method.id} className="flex justify-between gap-3 py-4 text-sm">
                  <div>
                    <div className="font-medium">
                      {method.label} {method.isDefault ? '(Default)' : ''}
                    </div>
                    <div className="text-gray-500">
                      {method.provider} {method.brand ? `· ${method.brand}` : ''}{' '}
                      {method.last4 ? `•••• ${method.last4}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeItem(`payment-methods/${method.id}`, 'Payment method removed.')}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {data.paymentMethods.length === 0 && <EmptyText text="No payment methods saved yet." />}
            </ListBlock>
          </Panel>

          {isAdvisor && data.advisor && (
            <>
              <Panel title="Advisor Profile">
                <form onSubmit={handleAdvisorSave} className="space-y-3">
                  <Input label="Display name" value={advisorForm.displayName} onChange={(displayName) => setAdvisorForm((f) => ({ ...f, displayName }))} />
                  <Input label="Rate per minute" value={advisorForm.ratePerMinute} onChange={(ratePerMinute) => setAdvisorForm((f) => ({ ...f, ratePerMinute }))} type="number" />
                  <label className="block text-sm font-medium text-gray-700">
                    Bio
                    <textarea
                      value={advisorForm.bio}
                      onChange={(event) => setAdvisorForm((f) => ({ ...f, bio: event.target.value }))}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={advisorForm.isOnline}
                      onChange={(event) => setAdvisorForm((f) => ({ ...f, isOnline: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-purple-700"
                    />
                    Available online
                  </label>
                  <PrimaryButton disabled={saving === 'advisor'}>
                    Save Advisor Profile
                  </PrimaryButton>
                </form>
              </Panel>

              <Panel title="Payout Methods">
                <form onSubmit={handlePayoutSave} className="space-y-3">
                  <Input label="Label" value={payoutForm.label} onChange={(label) => setPayoutForm((f) => ({ ...f, label }))} required />
                  <Input label="Method type" value={payoutForm.methodType} onChange={(methodType) => setPayoutForm((f) => ({ ...f, methodType }))} required />
                  <Input label="Account name" value={payoutForm.accountName} onChange={(accountNameValue) => setPayoutForm((f) => ({ ...f, accountName: accountNameValue }))} required />
                  <Input label="Notes" value={payoutForm.details} onChange={(details) => setPayoutForm((f) => ({ ...f, details }))} />
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={payoutForm.isDefault}
                      onChange={(event) => setPayoutForm((f) => ({ ...f, isDefault: event.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-purple-700"
                    />
                    Default payout method
                  </label>
                  <PrimaryButton disabled={saving === 'payout'}>
                    Save Payout Method
                  </PrimaryButton>
                </form>
                <ListBlock>
                  {data.advisor.payoutMethods.map((method) => (
                    <div key={method.id} className="flex justify-between gap-3 py-4 text-sm">
                      <div>
                        <div className="font-medium">
                          {method.label} {method.isDefault ? '(Default)' : ''}
                        </div>
                        <div className="text-gray-500">
                          {method.methodType} · {method.accountName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeItem(`payout-methods/${method.id}`, 'Payout method removed.')}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {data.advisor.payoutMethods.length === 0 && <EmptyText text="No payout methods saved yet." />}
                </ListBlock>
              </Panel>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-gray-950">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{detail}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  actionHref,
  actionLabel,
}: {
  title: string;
  children: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {actionHref && actionLabel && (
          <a href={actionHref} className="text-sm font-semibold text-purple-700 hover:text-purple-800">
            {actionLabel}
          </a>
        )}
      </div>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className="mt-1 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
        {value}
      </div>
    </div>
  );
}

function ListBlock({ children }: { children: ReactNode }) {
  return <div className="mt-4 divide-y border-t border-gray-100">{children}</div>;
}

function EmptyText({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed bg-gray-50 p-4 text-sm text-gray-500">{text}</p>;
}

function PrimaryButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
