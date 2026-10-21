'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';

type StepKey = 'agreement' | 'w9' | 'displayName' | 'photo' | 'rate' | 'payment';

interface Step {
  key: StepKey;
  label: string;
  done: boolean;
  detail: string | null;
}

type Block = { type: 'intro' | 'heading' | 'paragraph' | 'bullet'; text: string };

interface Status {
  completed: boolean;
  steps: Step[];
  name: string;
  profile: {
    displayName: string;
    username: string | null;
    ratePerMinute: number;
    profileImageUrl: string | null;
    paymentMethod: 'PAYPAL' | 'DIRECT_DEPOSIT';
    paypalEmail: string | null;
  };
  limits: { minRate: number; maxRate: number; maxUploadMb: number };
  documents: Record<string, { fileName: string; source: string; submittedAt: string } | null>;
  agreement: {
    title: string;
    blocks: Block[];
    acknowledgements: string[];
    advisor: { name: string; email: string; phone: string };
  };
}

const API = '/api/proxy/advisor-onboarding/me';
const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-purple-600 focus:outline-none focus:ring-1 focus:ring-purple-600';
const primary = 'rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800 disabled:opacity-50';
const secondary = 'rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? fallback;
}

async function send(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(await readError(res, 'That did not work. Please try again.'));
  return res.json().catch(() => ({}));
}

const postJson = (path: string, body: unknown) =>
  send(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** Busy / error handling shared by every step's form. */
function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ErrorLine({ message }: { message: string }) {
  return message ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p> : null;
}

/** Download the blank form, fill it in outside the site, and upload it here instead of filling it in online. */
function UploadAlternative({ type, formName, status, reload }: { type: 'agreement' | 'w9' | 'direct-deposit'; formName: string; status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-800">Prefer to complete the {formName} yourself?</p>
      <p className="mt-1 text-sm text-gray-600">
        Download the blank form, fill it in and sign it, then upload it here as a PDF or a JPG/PNG photo or scan (up to {status.limits.maxUploadMb} MB).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={`${API}/forms/${type}/blank`} className={secondary}>
          Download the blank form
        </a>
        <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
        <button
          type="button"
          disabled={busy || !file}
          className={secondary}
          onClick={() =>
            void run(async () => {
              const body = new FormData();
              body.append('file', file as File);
              await send(`/documents/${type}/upload`, { method: 'POST', body });
              setFile(null);
            })
          }
        >
          {busy ? 'Uploading...' : 'Upload completed form'}
        </button>
      </div>
      <div className="mt-3">
        <ErrorLine message={error} />
      </div>
    </div>
  );
}

function SubmittedNote({ type, doc, label }: { type: 'agreement' | 'w9' | 'direct-deposit'; doc: { fileName: string; source: string; submittedAt: string } | null; label: string }) {
  if (!doc) return null;
  return (
    <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Your {label} was {doc.source === 'ONLINE' ? 'completed on the site' : 'uploaded'} on {new Date(doc.submittedAt).toLocaleDateString()}.{' '}
      <a href={`${API}/documents/${type}`} className="font-medium underline">
        Download your copy
      </a>
      . You can submit it again below to replace it.
    </p>
  );
}

// ── Agreement ────────────────────────────────────────────────────────────────

function AgreementPanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const agreement = status.agreement;
  const [ticks, setTicks] = useState<boolean[]>(agreement.acknowledgements.map(() => false));
  const [professionalName, setProfessionalName] = useState(status.profile.displayName.startsWith('Advisor ') ? '' : status.profile.displayName);
  const [signature, setSignature] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => postJson('/agreement', { professionalName, signature, acknowledgements: ticks }));
  }

  return (
    <div>
      <SubmittedNote type="agreement" doc={status.documents.AGREEMENT} label="Advisor Agreement" />
      <form onSubmit={submit} className="space-y-5">
        <h4 className="text-lg font-semibold text-gray-900">{agreement.title}</h4>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
          {agreement.blocks.map((block, index) =>
            block.type === 'heading' ? (
              <h5 key={index} className="pt-3 font-bold text-gray-950">
                {block.text}
              </h5>
            ) : block.type === 'bullet' ? (
              <p key={index} className="pl-5 -indent-3">
                • {block.text}
              </p>
            ) : (
              <p key={index}>{block.text}</p>
            ),
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold uppercase tracking-wide text-gray-700">Advisor acknowledgement. I certify that:</legend>
          {agreement.acknowledgements.map((statement, index) => (
            <label key={statement} className="flex items-start gap-3 text-sm text-gray-800">
              <input type="checkbox" className="mt-1" checked={ticks[index]} onChange={(event) => setTicks((current) => current.map((tick, i) => (i === index ? event.target.checked : tick)))} />
              {statement}
            </label>
          ))}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm">
            <p className="font-medium text-gray-700">Advisor name</p>
            <p className="mt-1 rounded-lg bg-gray-100 px-3 py-2.5 text-gray-900">{agreement.advisor.name}</p>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Professional name
            <input value={professionalName} onChange={(event) => setProfessionalName(event.target.value)} required minLength={2} maxLength={120} className={field} />
          </label>
          <div className="text-sm">
            <p className="font-medium text-gray-700">Email</p>
            <p className="mt-1 rounded-lg bg-gray-100 px-3 py-2.5 text-gray-900">{agreement.advisor.email}</p>
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-700">Phone</p>
            <p className="mt-1 rounded-lg bg-gray-100 px-3 py-2.5 text-gray-900">{agreement.advisor.phone || 'Not given'}</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          Signature: type your full legal name
          <input value={signature} onChange={(event) => setSignature(event.target.value)} required minLength={2} maxLength={120} autoComplete="off" className={`${field} font-serif text-lg italic`} />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Typing your name signs the agreement electronically. We record the date, time and your internet address with it.
          </span>
        </label>

        <ErrorLine message={error} />
        <button type="submit" disabled={busy || !ticks.every(Boolean) || signature.trim().length < 2 || professionalName.trim().length < 2} className={primary}>
          {busy ? 'Signing...' : 'Sign the agreement'}
        </button>
      </form>
      <UploadAlternative type="agreement" formName="Advisor Agreement" status={status} reload={reload} />
    </div>
  );
}

// ── W-9 ──────────────────────────────────────────────────────────────────────

const CLASSIFICATIONS: [string, string][] = [
  ['INDIVIDUAL', 'Individual / sole proprietor or single-member LLC'],
  ['C_CORP', 'C Corporation'],
  ['S_CORP', 'S Corporation'],
  ['PARTNERSHIP', 'Partnership'],
  ['TRUST_ESTATE', 'Trust / estate'],
  ['LLC', 'Limited liability company (LLC)'],
  ['OTHER', 'Other'],
];

function W9Panel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [form, setForm] = useState({
    name: status.agreement.advisor.name,
    businessName: '',
    classification: 'INDIVIDUAL',
    llcTaxClass: 'C',
    otherClassification: '',
    foreignPartners: false,
    exemptPayeeCode: '',
    fatcaCode: '',
    address: '',
    cityStateZip: '',
    accountNumbers: '',
    tinType: 'SSN',
    tin: '',
    signature: '',
    certify: false,
    notBackupWithholding: false,
  });
  const [showTin, setShowTin] = useState(false);
  const set = <K extends keyof typeof form>(key: K) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const { llcTaxClass, otherClassification, foreignPartners, businessName, exemptPayeeCode, fatcaCode, accountNumbers, ...rest } = form;
    void run(() =>
      postJson('/w9', {
        ...rest,
        ...(businessName.trim() ? { businessName } : {}),
        ...(form.classification === 'LLC' ? { llcTaxClass } : {}),
        ...(form.classification === 'OTHER' ? { otherClassification } : {}),
        ...(['PARTNERSHIP', 'TRUST_ESTATE'].includes(form.classification) ? { foreignPartners } : {}),
        ...(exemptPayeeCode.trim() ? { exemptPayeeCode } : {}),
        ...(fatcaCode.trim() ? { fatcaCode } : {}),
        ...(accountNumbers.trim() ? { accountNumbers } : {}),
      }),
    );
  }

  return (
    <div>
      <SubmittedNote type="w9" doc={status.documents.W9} label="W-9" />
      <p className="mb-4 text-sm text-gray-600">
        The Psychic Link needs a Form W-9 from every advisor to report what we pay you. This fills in the official IRS Form W-9 with your answers.
        Your Social Security number or EIN is stored encrypted, and only authorized staff can open the form.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm font-medium text-gray-700">
          1. Name (as shown on your income tax return)
          <input value={form.name} onChange={set('name')} required maxLength={100} className={field} />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          2. Business name / disregarded entity name, if different (optional)
          <input value={form.businessName} onChange={set('businessName')} maxLength={100} className={field} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            3a. Federal tax classification
            <select value={form.classification} onChange={set('classification')} className={field}>
              {CLASSIFICATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.classification === 'LLC' && (
            <label className="block text-sm font-medium text-gray-700">
              LLC tax classification
              <select value={form.llcTaxClass} onChange={set('llcTaxClass')} className={field}>
                <option value="C">C: C corporation</option>
                <option value="S">S: S corporation</option>
                <option value="P">P: Partnership</option>
              </select>
            </label>
          )}
          {form.classification === 'OTHER' && (
            <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
              Describe the classification
              <input value={form.otherClassification} onChange={set('otherClassification')} required maxLength={60} className={field} />
            </label>
          )}
          {['PARTNERSHIP', 'TRUST_ESTATE'].includes(form.classification) && (
            <label className="flex items-start gap-3 text-sm text-gray-800 sm:col-span-2">
              <input type="checkbox" className="mt-1" checked={form.foreignPartners} onChange={(event) => setForm((c) => ({ ...c, foreignPartners: event.target.checked }))} />
              3b. I have foreign partners, owners or beneficiaries
            </label>
          )}
          <label className="block text-sm font-medium text-gray-700">
            4. Exempt payee code (usually blank)
            <input value={form.exemptPayeeCode} onChange={set('exemptPayeeCode')} maxLength={10} className={field} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            FATCA exemption code (usually blank)
            <input value={form.fatcaCode} onChange={set('fatcaCode')} maxLength={10} className={field} />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700">
          5. Address (number, street, and apartment or suite number)
          <input value={form.address} onChange={set('address')} required maxLength={100} autoComplete="street-address" className={field} />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          6. City, state, and ZIP code
          <input value={form.cityStateZip} onChange={set('cityStateZip')} required maxLength={100} placeholder="Orlando, FL 32801" className={field} />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          7. Account number(s) (optional)
          <input value={form.accountNumbers} onChange={set('accountNumbers')} maxLength={50} className={field} />
        </label>

        <fieldset className="rounded-xl border p-4">
          <legend className="px-2 text-sm font-bold text-gray-800">Part I: Taxpayer identification number (TIN)</legend>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={form.tinType === 'SSN'} onChange={() => setForm((c) => ({ ...c, tinType: 'SSN' }))} />
                Social security number
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={form.tinType === 'EIN'} onChange={() => setForm((c) => ({ ...c, tinType: 'EIN' }))} />
                Employer identification number
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              {form.tinType === 'SSN' ? 'SSN (9 digits)' : 'EIN (9 digits)'}
              <input
                type={showTin ? 'text' : 'password'}
                value={form.tin}
                onChange={set('tin')}
                required
                inputMode="numeric"
                autoComplete="off"
                maxLength={11}
                className={`${field} w-48 font-mono`}
              />
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input type="checkbox" checked={showTin} onChange={(event) => setShowTin(event.target.checked)} />
              Show
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border p-4">
          <legend className="px-2 text-sm font-bold text-gray-800">Part II: Certification</legend>
          <p className="text-xs text-gray-600">
            Under penalties of perjury, I certify that: (1) the number shown on this form is my correct taxpayer identification number; (2) I am
            not subject to backup withholding, or I have not been notified by the IRS that I am subject to backup withholding as a result of a
            failure to report all interest or dividends, or the IRS has notified me that I am no longer subject to backup withholding; (3) I am
            a U.S. citizen or other U.S. person; and (4) the FATCA code(s) entered on this form (if any) are correct.
          </p>
          <label className="mt-3 flex items-start gap-3 text-sm text-gray-800">
            <input type="checkbox" className="mt-1" checked={form.certify} onChange={(event) => setForm((c) => ({ ...c, certify: event.target.checked }))} />
            I certify the statements above are true, correct and complete.
          </label>
          <label className="mt-2 flex items-start gap-3 text-sm text-gray-800">
            <input type="checkbox" className="mt-1" checked={form.notBackupWithholding} onChange={(event) => setForm((c) => ({ ...c, notBackupWithholding: event.target.checked }))} />
            The IRS has not told me that I am currently subject to backup withholding. (If it has, use the upload option below instead.)
          </label>
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Signature of U.S. person: type your full legal name
            <input value={form.signature} onChange={set('signature')} required minLength={2} maxLength={120} autoComplete="off" className={`${field} font-serif text-lg italic`} />
          </label>
        </fieldset>

        <ErrorLine message={error} />
        <button type="submit" disabled={busy || !form.certify || !form.notBackupWithholding} className={primary}>
          {busy ? 'Submitting...' : 'Submit W-9'}
        </button>
      </form>
      <UploadAlternative type="w9" formName="W-9" status={status} reload={reload} />
    </div>
  );
}

// ── Direct deposit (part of choosing how to be paid) ─────────────────────────

function DirectDepositPanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [form, setForm] = useState({
    accountHolder: status.agreement.advisor.name,
    bankName: '',
    accountType: 'CHECKING',
    routingNumber: '',
    accountNumber: '',
    accountNumberConfirm: '',
    signature: '',
    authorize: false,
  });
  const set = <K extends keyof typeof form>(key: K) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div>
      <SubmittedNote type="direct-deposit" doc={status.documents.DIRECT_DEPOSIT} label="Direct Deposit form" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => postJson('/direct-deposit', form));
        }}
        className="space-y-5"
      >
        <p className="text-sm text-gray-600">
          Fill in the Direct Deposit Authorization so we can pay what you earn straight into your bank account. It is stored encrypted, and only
          authorized staff can open it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Name of account holder
            <input value={form.accountHolder} onChange={set('accountHolder')} required minLength={2} maxLength={100} className={field} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Bank name
            <input value={form.bankName} onChange={set('bankName')} required minLength={2} maxLength={100} className={field} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Type of account
            <select value={form.accountType} onChange={set('accountType')} className={field}>
              <option value="CHECKING">Checking</option>
              <option value="SAVINGS">Savings</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Bank routing number (9 digits)
            <input value={form.routingNumber} onChange={set('routingNumber')} required inputMode="numeric" autoComplete="off" maxLength={20} className={`${field} font-mono`} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Account number
            <input value={form.accountNumber} onChange={set('accountNumber')} required inputMode="numeric" autoComplete="off" maxLength={30} className={`${field} font-mono`} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Account number again
            <input value={form.accountNumberConfirm} onChange={set('accountNumberConfirm')} required inputMode="numeric" autoComplete="off" maxLength={30} className={`${field} font-mono`} />
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm text-gray-800">
          <input type="checkbox" className="mt-1" checked={form.authorize} onChange={(event) => setForm((c) => ({ ...c, authorize: event.target.checked }))} />
          I authorize The Psychic Link to send direct deposits to this account for amounts owed to me, and to correct any deposit made in error. I
          confirm the account information is correct and that I am an authorized owner of the account.
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Signature: type your full legal name
          <input value={form.signature} onChange={set('signature')} required minLength={2} maxLength={120} autoComplete="off" className={`${field} font-serif text-lg italic`} />
        </label>
        <ErrorLine message={error} />
        <button type="submit" disabled={busy || !form.authorize} className={primary}>
          {busy ? 'Submitting...' : 'Submit and use Direct Deposit'}
        </button>
      </form>
      <UploadAlternative type="direct-deposit" formName="Direct Deposit form" status={status} reload={reload} />
    </div>
  );
}

function PaymentPanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [method, setMethod] = useState<'PAYPAL' | 'DIRECT_DEPOSIT'>(status.profile.paymentMethod);
  const [email, setEmail] = useState(status.profile.paypalEmail ?? '');
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Choose how The Psychic Link pays what you earn. You can change this later from your dashboard.
      </p>
      <label className="block text-sm font-medium text-gray-700">
        Payment method
        <select value={method} onChange={(event) => setMethod(event.target.value as 'PAYPAL' | 'DIRECT_DEPOSIT')} className={`${field} sm:w-72`}>
          <option value="PAYPAL">PayPal</option>
          <option value="DIRECT_DEPOSIT">Direct Deposit</option>
        </select>
      </label>

      {method === 'PAYPAL' ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => postJson('/payment/paypal', { paypalEmail: email }));
          }}
          className="space-y-4"
        >
          <label className="block text-sm font-medium text-gray-700">
            PayPal email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} className={`${field} sm:w-96`} />
          </label>
          <ErrorLine message={error} />
          <button type="submit" disabled={busy} className={primary}>
            {busy ? 'Saving...' : 'Use PayPal'}
          </button>
        </form>
      ) : (
        <DirectDepositPanel status={status} reload={reload} />
      )}
    </div>
  );
}

// ── Display name, photo, rate ────────────────────────────────────────────────

function DisplayNamePanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [name, setName] = useState(status.profile.displayName.startsWith('Advisor ') ? '' : status.profile.displayName);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => postJson('/display-name', { displayName: name }));
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600">
        This is the name clients see, for example &ldquo;Psychic Denise&rdquo;. Your real name and email address are never shown. Use 3 to 30
        letters or numbers; the same name makes your profile link.
      </p>
      <label className="block text-sm font-medium text-gray-700">
        Display name
        <input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={30} className={`${field} sm:w-96`} />
      </label>
      <ErrorLine message={error} />
      <button type="submit" disabled={busy || name.trim().length < 3} className={primary}>
        {busy ? 'Saving...' : 'Save display name'}
      </button>
    </form>
  );
}

function PhotoPanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Clients see this photo on your profile. Use a clear, friendly picture (JPG, PNG, GIF or WEBP).</p>
      {status.profile.profileImageUrl && (
        <img src={status.profile.profileImageUrl} alt="Your profile" className="h-28 w-28 rounded-full object-cover ring-2 ring-purple-200" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
        <button
          type="button"
          disabled={busy || !file}
          className={primary}
          onClick={() =>
            void run(async () => {
              const body = new FormData();
              body.append('file', file as File);
              const res = await fetch('/api/proxy/account/advisor-profile/image', { method: 'POST', body });
              if (!res.ok) throw new Error(await readError(res, 'The photo could not be uploaded.'));
              setFile(null);
            })
          }
        >
          {busy ? 'Uploading...' : status.profile.profileImageUrl ? 'Replace photo' : 'Upload photo'}
        </button>
      </div>
      <ErrorLine message={error} />
    </div>
  );
}

function RatePanel({ status, reload }: { status: Status; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction(reload);
  const [rate, setRate] = useState(status.profile.ratePerMinute > 0 ? status.profile.ratePerMinute.toFixed(2) : '');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void run(() => postJson('/rate', { ratePerMinute: Number(rate) }));
      }}
      className="space-y-4"
    >
      <p className="text-sm text-gray-600">
        What clients pay per minute to speak with you, from ${status.limits.minRate.toFixed(2)} to ${status.limits.maxRate.toFixed(2)}. You can change it later from your dashboard.
      </p>
      <label className="block text-sm font-medium text-gray-700">
        Rate per minute ($)
        <input type="number" min={status.limits.minRate} max={status.limits.maxRate} step={0.01} value={rate} onChange={(event) => setRate(event.target.value)} required className={`${field} sm:w-40`} />
      </label>
      <ErrorLine message={error} />
      <button type="submit" disabled={busy || !rate} className={primary}>
        {busy ? 'Saving...' : 'Save rate'}
      </button>
    </form>
  );
}

// ── The checklist ────────────────────────────────────────────────────────────

function StepCard({ index, step, open, onToggle, children }: { index: number; step: Step; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${step.done ? 'bg-emerald-600 text-white' : 'bg-purple-100 text-purple-800'}`}
          aria-hidden="true"
        >
          {step.done ? '✓' : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-950">{step.label}</span>
          <span className="block truncate text-sm text-gray-500">{step.done ? step.detail ?? 'Done' : 'Not done yet'}</span>
        </span>
        <span className="text-gray-400" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && <div className="border-t px-5 py-5">{children}</div>}
    </section>
  );
}

/** The advisor's onboarding checklist: sign the agreement, send the W-9, pick a name, photo, rate and how to be paid. */
export function AdvisorOnboarding() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<StepKey | null>(null);
  const [opened, setOpened] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(API);
      if (res.status === 401 || res.status === 403) {
        setSignedOut(true);
        return;
      }
      if (!res.ok) throw new Error(await readError(res, 'Unable to load your onboarding checklist.'));
      const data = (await res.json()) as Status;
      setStatus(data);
      setError('');
      // Open the first step still to do the first time, and then move on when a step is finished.
      setOpen((current) => {
        if (current && !data.steps.find((step) => step.key === current)?.done) return current;
        return data.steps.find((step) => !step.done)?.key ?? null;
      });
      setOpened(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load your onboarding checklist.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (signedOut) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-gray-700">Sign in with your advisor account to see your onboarding checklist.</p>
        <a href="/login?next=/advisor/onboarding" className="mt-4 inline-block rounded-lg bg-purple-700 px-6 py-3 font-semibold text-white hover:bg-purple-800">
          Sign in
        </a>
        <p className="mt-4 text-sm text-gray-500">If you have not set a password yet, open the link in your approval email first.</p>
      </div>
    );
  }
  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (!status || !opened) return <p className="text-gray-500">Loading your checklist…</p>;

  const doneCount = status.steps.filter((step) => step.done).length;
  const panels: Record<StepKey, ReactNode> = {
    agreement: <AgreementPanel status={status} reload={reload} />,
    w9: <W9Panel status={status} reload={reload} />,
    displayName: <DisplayNamePanel status={status} reload={reload} />,
    photo: <PhotoPanel status={status} reload={reload} />,
    rate: <RatePanel status={status} reload={reload} />,
    payment: <PaymentPanel status={status} reload={reload} />,
  };

  return (
    <div className="space-y-6">
      {status.completed ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-xl font-semibold text-emerald-900">You are all set!</h2>
          <p className="mt-2 text-emerald-900">
            Every step is done. Your profile is live, and you can turn on calls from your dashboard whenever you are ready to take them.
          </p>
          <a href="/advisor" className="mt-4 inline-block rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800">
            Go to my dashboard
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm font-medium text-gray-700">
            <span>
              {doneCount} of {status.steps.length} steps done
            </span>
            <span>{Math.round((doneCount / status.steps.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-purple-600 transition-all" style={{ width: `${(doneCount / status.steps.length) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-gray-600">Finish every step to go live. You can leave and come back; your progress is saved.</p>
        </div>
      )}

      {status.steps.map((step, index) => (
        <StepCard key={step.key} index={index} step={step} open={open === step.key} onToggle={() => setOpen(open === step.key ? null : step.key)}>
          {panels[step.key]}
        </StepCard>
      ))}
    </div>
  );
}
