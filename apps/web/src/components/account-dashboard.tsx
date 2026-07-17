'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { PrivateMessageInbox } from './private-message-inbox';

type DashboardMode = 'client' | 'advisor';
type DashboardSection =
  | 'messages'
  | 'orders'
  | 'downloads'
  | 'addresses'
  | 'payments'
  | 'wallet'
  | 'account'
  | 'advisor-profile'
  | 'payouts'
  | 'calls';

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
  profileImageUrl?: string | null;
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

interface AstrologyDownload {
  id: string;
  status: string;
  reportUrl?: string | null;
  reportText?: string | null;
  fileName?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  generatedAt?: string | null;
  product: { id: string; name: string };
  order: { id: string; status: string; createdAt: string };
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
  downloads: AstrologyDownload[];
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
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
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
  const [activeSection, setActiveSection] = useState<DashboardSection>('messages');

  const isAdvisor = mode === 'advisor';
  const messagesHref = isAdvisor ? '/advisor/messages' : '/client/messages';
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.location.href = '/';
  }

  async function handleProfileImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !isAdvisor) return;
    setUploadingProfileImage(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/proxy/account/advisor-profile/image', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? 'Profile image upload failed');
      }
      setSuccess('Profile image updated.');
      await fetchDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Profile image upload failed');
    } finally {
      setUploadingProfileImage(false);
    }
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

  const displayName = data.advisor?.profile.displayName || data.user.name;
  const roleLabel = isAdvisor ? 'Spiritual Advisor' : data.user.role === 'CLIENT' ? 'Client' : data.user.role;
  const profileImageUrl = data.advisor?.profile.profileImageUrl ?? null;
  const walletValue = data.wallet.balanceMinutes === null ? 'Not set' : `${data.wallet.balanceMinutes} min`;
  const navItems: Array<{ id: DashboardSection; label: string; icon: string; badge?: number }> = [
    { id: 'messages', label: 'Messages', icon: 'fa-regular fa-comments', badge: data.messages.unreadCount },
    { id: 'orders', label: 'Orders', icon: 'fa-solid fa-bag-shopping' },
    { id: 'downloads', label: 'Downloads', icon: 'fa-solid fa-download' },
    { id: 'addresses', label: 'Saved Addresses', icon: 'fa-solid fa-location-dot' },
    { id: 'payments', label: 'Saved Payments', icon: 'fa-regular fa-credit-card' },
    { id: 'wallet', label: 'Wallet', icon: 'fa-solid fa-wallet' },
    { id: 'account', label: 'Account Details', icon: 'fa-regular fa-user' },
    ...(isAdvisor
      ? [
          { id: 'advisor-profile' as const, label: 'Advisor Profile', icon: 'fa-regular fa-id-card' },
          { id: 'payouts' as const, label: 'Payout Info', icon: 'fa-regular fa-file-lines' },
          { id: 'calls' as const, label: 'Call Transactions', icon: 'fa-solid fa-phone-volume' },
        ]
      : []),
  ];
  const activeLabel = navItems.find((item) => item.id === activeSection)?.label ?? 'Messages';

  return (
    <main className="mx-auto w-full max-w-7xl p-8">
      <header className="mb-10">
        <h1 className="text-5xl font-bold tracking-tight text-gray-950">Dashboard</h1>
        <p className="mt-4 text-2xl text-gray-700">
          Welcome back, <span className="font-semibold text-purple-700">{displayName}</span>!
        </p>
      </header>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <section className="mb-9 grid gap-5 lg:grid-cols-3">
        <TopCard className="items-center text-center">
          {profileImageUrl ? (
            <img src={profileImageUrl} alt={displayName} className="h-32 w-32 rounded-full object-cover" />
          ) : (
            <div className="grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-purple-100 via-white to-purple-200 text-5xl font-bold text-purple-700">
              {initials(displayName)}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-950">{displayName}</h2>
            <p className="mt-1 text-lg text-gray-600">{roleLabel}</p>
          </div>
          {isAdvisor && (
            <>
              <input ref={profileImageInputRef} type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
              <button
                type="button"
                onClick={() => profileImageInputRef.current?.click()}
                disabled={uploadingProfileImage}
                className="mt-4 inline-flex items-center gap-3 rounded-lg border border-purple-500 px-8 py-3 font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
              >
                <i className="fa-regular fa-image" />
                {uploadingProfileImage ? 'Uploading...' : 'Change Image'}
              </button>
            </>
          )}
        </TopCard>

        <TopCard className="items-center text-center">
          <IconBubble icon="fa-solid fa-phone" />
          <h2 className="text-2xl font-bold text-gray-950">Call Availability</h2>
          <ToggleSwitch enabled={advisorForm.isOnline} />
          <p className={advisorForm.isOnline ? 'font-semibold text-green-600' : 'font-semibold text-gray-500'}>
            {advisorForm.isOnline ? 'On' : 'Off'} <span className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-current" />
          </p>
          <p className="max-w-xs text-center text-sm text-gray-500">
            {isAdvisor ? 'Clients will be able to call you when you are available.' : 'Advisor call availability appears here.'}
          </p>
        </TopCard>

        <TopCard className="items-center text-center">
          <IconBubble icon="fa-solid fa-wallet" />
          <h2 className="text-2xl font-bold text-gray-950">Wallet Balance</h2>
          <div>
            <p className="text-5xl font-bold text-gray-950">{walletValue}</p>
            <p className="mt-2 text-lg text-gray-600">Available</p>
          </div>
          <button type="button" onClick={() => setActiveSection('wallet')} className="mt-3 rounded-lg border border-purple-500 px-8 py-3 font-semibold text-purple-700 hover:bg-purple-50">
            View Wallet
          </button>
        </TopCard>
      </section>

      <section className="grid overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-[350px_minmax(0,1fr)]">
        <nav className="border-b bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="grid gap-2">
            {navItems.map((item) => (
              <DashboardNavItem
                key={item.id}
                item={item}
                active={activeSection === item.id}
                onClick={() => setActiveSection(item.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left text-lg text-gray-700 transition hover:bg-gray-50"
            >
              <i className="fa-solid fa-arrow-right-from-bracket w-6 text-2xl text-gray-500" />
              <span>Log Out</span>
            </button>
          </div>
        </nav>

        <section className="min-h-[640px] p-8">
          <div className="mb-8 flex items-center gap-5">
            <IconBubble icon={navItems.find((item) => item.id === activeSection)?.icon ?? 'fa-regular fa-comments'} small />
            <h2 className="text-3xl font-bold text-gray-950">{activeLabel}</h2>
          </div>

          {activeSection === 'messages' && (
            <PrivateMessageInbox title="Messages" description="Send and receive private messages." backHref={messagesHref} embedded />
          )}

          {activeSection === 'orders' && (
            <div>
              {data.orders.length === 0 ? (
                <EmptyText text="No orders have been placed yet." />
              ) : (
                <div className="divide-y">
                  {data.orders.map((order) => (
                    <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                      <div>
                        <p className="font-mono text-xs text-gray-500">#{order.id.slice(0, 12)}</p>
                        <p className="mt-1 font-semibold text-gray-950">{order.items.map((item) => item.product.name).join(', ') || 'Order'}</p>
                        <p className="mt-1 text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">{order.status}</span>
                        <p className="mt-2 text-lg font-bold">${Number(order.totalAmount).toFixed(2)} {order.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'downloads' && (
            <div>
              {data.downloads.length === 0 ? (
                <EmptyText text="No downloads are available yet." />
              ) : (
                <div className="divide-y">
                  {data.downloads.map((download) => (
                    <div key={download.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                      <div>
                        <p className="font-semibold text-gray-950">{download.product.name}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Order #{download.order.id.slice(0, 12)} · {new Date(download.createdAt).toLocaleDateString()}
                        </p>
                        {download.errorMessage && (
                          <p className="mt-2 max-w-2xl rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            {download.errorMessage}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                          {download.status.replaceAll('_', ' ')}
                        </span>
                        {download.reportUrl ? (
                          <a
                            href={download.reportUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                          >
                            Open Download
                          </a>
                        ) : (
                          <span className="text-sm text-gray-500">Your report is being prepared. It will appear here when ready.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'addresses' && (
            <div>
              <form onSubmit={handleAddressSave} className="grid gap-4 md:grid-cols-2">
                <Input label="Label" value={addressForm.label} onChange={(label) => setAddressForm((f) => ({ ...f, label }))} required />
                <Input label="Full name" value={addressForm.fullName} onChange={(fullName) => setAddressForm((f) => ({ ...f, fullName }))} required />
                <Input label="Phone" value={addressForm.phone} onChange={(phone) => setAddressForm((f) => ({ ...f, phone }))} />
                <Input label="Street address" value={addressForm.line1} onChange={(line1) => setAddressForm((f) => ({ ...f, line1 }))} required />
                <Input label="Address line 2" value={addressForm.line2} onChange={(line2) => setAddressForm((f) => ({ ...f, line2 }))} />
                <Input label="City" value={addressForm.city} onChange={(city) => setAddressForm((f) => ({ ...f, city }))} required />
                <Input label="State" value={addressForm.state} onChange={(state) => setAddressForm((f) => ({ ...f, state }))} required />
                <Input label="Postal code" value={addressForm.postalCode} onChange={(postalCode) => setAddressForm((f) => ({ ...f, postalCode }))} required />
                <Checkbox checked={addressForm.isDefault} label="Default address" onChange={(isDefault) => setAddressForm((f) => ({ ...f, isDefault }))} />
                <div className="md:col-span-2"><PrimaryButton disabled={saving === 'address'}>Save Address</PrimaryButton></div>
              </form>
              <ListBlock>
                {data.addresses.map((address) => (
                  <RemovableRow key={address.id} title={`${address.label}${address.isDefault ? ' (Default)' : ''}`} detail={`${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`} onRemove={() => void removeItem(`addresses/${address.id}`, 'Address removed.')} />
                ))}
                {data.addresses.length === 0 && <EmptyText text="No saved addresses yet." />}
              </ListBlock>
            </div>
          )}

          {activeSection === 'payments' && (
            <div>
              <form onSubmit={handlePaymentSave} className="grid gap-4 md:grid-cols-2">
                <Input label="Label" value={paymentForm.label} onChange={(label) => setPaymentForm((f) => ({ ...f, label }))} required />
                <Input label="Provider" value={paymentForm.provider} onChange={(provider) => setPaymentForm((f) => ({ ...f, provider }))} required />
                <Input label="Brand" value={paymentForm.brand} onChange={(brand) => setPaymentForm((f) => ({ ...f, brand }))} />
                <Input label="Last 4" value={paymentForm.last4} onChange={(last4) => setPaymentForm((f) => ({ ...f, last4 }))} />
                <Checkbox checked={paymentForm.isDefault} label="Default payment method" onChange={(isDefault) => setPaymentForm((f) => ({ ...f, isDefault }))} />
                <div className="md:col-span-2"><PrimaryButton disabled={saving === 'payment'}>Save Payment Method</PrimaryButton></div>
              </form>
              <ListBlock>
                {data.paymentMethods.map((method) => (
                  <RemovableRow key={method.id} title={`${method.label}${method.isDefault ? ' (Default)' : ''}`} detail={`${method.provider}${method.brand ? ` · ${method.brand}` : ''} ${method.last4 ? `**** ${method.last4}` : ''}`} onRemove={() => void removeItem(`payment-methods/${method.id}`, 'Payment method removed.')} />
                ))}
                {data.paymentMethods.length === 0 && <EmptyText text="No payment methods saved yet." />}
              </ListBlock>
            </div>
          )}

          {activeSection === 'wallet' && (
            <div>
              <div className="mb-6 rounded-2xl bg-purple-50 p-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Current balance</p>
                <p className="mt-2 text-4xl font-bold text-gray-950">{walletValue}</p>
                <a href="/shop" className="mt-5 inline-block rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800">Add money to wallet</a>
              </div>
              {data.wallet.transactions.length === 0 ? (
                <EmptyText text="No wallet transactions yet." />
              ) : (
                <div className="divide-y">
                  {data.wallet.transactions.map((transaction) => (
                    <div key={transaction.id} className="flex justify-between gap-4 py-4">
                      <div>
                        <p className="font-semibold">{transaction.type}</p>
                        <p className="text-sm text-gray-500">{transaction.description ?? transaction.currency}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{transaction.minutesDelta ?? Number(transaction.amount)}</p>
                        <p className="text-xs text-gray-500">{new Date(transaction.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'account' && (
            <form onSubmit={handleAccountSave} className="max-w-xl space-y-4">
              <Input label="Name" value={accountName} onChange={setAccountName} required />
              <ReadOnly label="Email" value={data.user.email} />
              <ReadOnly label="Role" value={data.user.role} />
              <PrimaryButton disabled={saving === 'account'}>Save Account</PrimaryButton>
            </form>
          )}

          {activeSection === 'advisor-profile' && isAdvisor && (
            <form onSubmit={handleAdvisorSave} className="max-w-2xl space-y-4">
              <Input label="Display name" value={advisorForm.displayName} onChange={(displayNameValue) => setAdvisorForm((f) => ({ ...f, displayName: displayNameValue }))} />
              <Input label="Rate per minute" value={advisorForm.ratePerMinute} onChange={(ratePerMinute) => setAdvisorForm((f) => ({ ...f, ratePerMinute }))} type="number" />
              <label className="block text-sm font-medium text-gray-700">
                Bio
                <textarea value={advisorForm.bio} onChange={(event) => setAdvisorForm((f) => ({ ...f, bio: event.target.value }))} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100" />
              </label>
              <Checkbox checked={advisorForm.isOnline} label="Available online" onChange={(isOnline) => setAdvisorForm((f) => ({ ...f, isOnline }))} />
              <PrimaryButton disabled={saving === 'advisor'}>Save Advisor Profile</PrimaryButton>
            </form>
          )}

          {activeSection === 'payouts' && isAdvisor && data.advisor && (
            <div>
              <form onSubmit={handlePayoutSave} className="grid gap-4 md:grid-cols-2">
                <Input label="Label" value={payoutForm.label} onChange={(label) => setPayoutForm((f) => ({ ...f, label }))} required />
                <Input label="Method type" value={payoutForm.methodType} onChange={(methodType) => setPayoutForm((f) => ({ ...f, methodType }))} required />
                <Input label="Account name" value={payoutForm.accountName} onChange={(accountNameValue) => setPayoutForm((f) => ({ ...f, accountName: accountNameValue }))} required />
                <Input label="Notes" value={payoutForm.details} onChange={(details) => setPayoutForm((f) => ({ ...f, details }))} />
                <Checkbox checked={payoutForm.isDefault} label="Default payout method" onChange={(isDefault) => setPayoutForm((f) => ({ ...f, isDefault }))} />
                <div className="md:col-span-2"><PrimaryButton disabled={saving === 'payout'}>Save Payout Method</PrimaryButton></div>
              </form>
              <ListBlock>
                {data.advisor.payoutMethods.map((method) => (
                  <RemovableRow key={method.id} title={`${method.label}${method.isDefault ? ' (Default)' : ''}`} detail={`${method.methodType} · ${method.accountName}`} onRemove={() => void removeItem(`payout-methods/${method.id}`, 'Payout method removed.')} />
                ))}
                {data.advisor.payoutMethods.length === 0 && <EmptyText text="No payout methods saved yet." />}
              </ListBlock>
            </div>
          )}

          {activeSection === 'calls' && isAdvisor && data.advisor && (
            <div>
              {data.advisor.callTransactions.length === 0 ? (
                <EmptyText text="No call transactions yet." />
              ) : (
                <div className="divide-y">
                  {data.advisor.callTransactions.map((call) => (
                    <div key={call.id} className="flex justify-between gap-4 py-4">
                      <div>
                        <p className="font-semibold">{call.client?.user?.name ?? 'Client call'}</p>
                        <p className="text-sm text-gray-500">{new Date(call.startedAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{call.status}</p>
                        <p className="text-sm text-gray-500">{call.billedMinutes ?? 0} min</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function TopCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <article className={`flex min-h-[300px] flex-col justify-center gap-5 rounded-2xl border bg-white p-8 shadow-sm ${className}`}>
      {children}
    </article>
  );
}

function IconBubble({ icon, small = false }: { icon: string; small?: boolean }) {
  return (
    <div className={`${small ? 'h-14 w-14 text-xl' : 'h-24 w-24 text-4xl'} grid place-items-center rounded-full bg-purple-100 text-purple-700`}>
      <i className={icon} />
    </div>
  );
}

function ToggleSwitch({ enabled }: { enabled: boolean }) {
  return (
    <span className={`relative inline-flex h-16 w-32 items-center rounded-full p-2 ${enabled ? 'bg-purple-700' : 'bg-gray-300'}`}>
      <span className={`h-12 w-12 rounded-full bg-white shadow transition ${enabled ? 'translate-x-16' : 'translate-x-0'}`} />
    </span>
  );
}

function DashboardNavItem({
  item,
  active,
  onClick,
}: {
  item: { id: DashboardSection; label: string; icon: string; badge?: number };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-4 py-4 text-left text-lg transition ${
        active ? 'bg-purple-50 text-gray-950 shadow-sm' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="flex items-center gap-4">
        <i className={`${item.icon} w-6 text-2xl ${active ? 'text-purple-700' : 'text-gray-500'}`} />
        <span>{item.label}</span>
      </span>
      {item.badge ? (
        <span className="grid h-8 min-w-8 place-items-center rounded-full bg-purple-700 px-2 text-sm font-bold text-white">
          {item.badge}
        </span>
      ) : null}
    </button>
  );
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-purple-700"
      />
      {label}
    </label>
  );
}

function RemovableRow({ title, detail, onRemove }: { title: string; detail: string; onRemove: () => void }) {
  return (
    <div className="flex justify-between gap-4 py-4">
      <div>
        <p className="font-semibold text-gray-950">{title}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <button type="button" onClick={onRemove} className="text-sm font-semibold text-red-600 hover:underline">
        Remove
      </button>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';
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
