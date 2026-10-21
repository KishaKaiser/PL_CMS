'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string;
  yearsExperience: number;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  onboarding: { activated: boolean; completed: boolean; done: number; total: number } | null;
}

interface List {
  counts: Record<Status, number>;
  applications: Row[];
}

interface Detail {
  id: string;
  name: string;
  email: string;
  phone: string;
  yearsExperience: number;
  gifts: string;
  readingStyle: string;
  status: Status;
  reviewNote: string | null;
  createdAt: string;
  onboarding: {
    activatedAt: string | null;
    emailSentAt: string | null;
    linkExpiresAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    steps: { key: string; label: string; done: boolean; detail: string | null }[];
  } | null;
  documents: { id: string; type: string; source: string; fileName: string; sizeBytes: number; createdAt: string; supersededAt: string | null }[];
}

interface Agreement {
  title: string;
  body: string;
  representativeName: string;
  representativeTitle: string;
  formsEmail: string;
}

interface LinkResult {
  link: string;
  emailSent: boolean;
  linkExpiresAt: string;
}

const TYPE_LABEL: Record<string, string> = { AGREEMENT: 'Advisor Agreement', W9: 'Form W-9', DIRECT_DEPOSIT: 'Direct Deposit form' };
const STATUS_STYLE: Record<Status, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  APPROVED: 'bg-emerald-100 text-emerald-900',
  REJECTED: 'bg-gray-200 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-800',
};
const STATUS_LABEL: Record<Status, string> = { PENDING: 'Waiting', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
const API = '/api/proxy/admin/advisor-applications';

async function readMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (Array.isArray(data.message)) return data.message.join(' ');
  return data.message ?? fallback;
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function AdminAdvisorApplicationsPage() {
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'all' | 'agreement'>('PENDING');
  const [list, setList] = useState<List | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [busy, setBusy] = useState(false);
  const [addType, setAddType] = useState('W9');
  const [addFile, setAddFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadList = useCallback(async () => {
    if (tab === 'agreement') return;
    try {
      const res = await fetch(`${API}?status=${tab}`);
      if (!res.ok) throw new Error(await readMessage(res, 'Unable to load applications'));
      setList((await res.json()) as List);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load applications');
    }
  }, [tab]);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/${id}`);
      if (!res.ok) throw new Error(await readMessage(res, 'Unable to load this application'));
      setDetail((await res.json()) as Detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load this application');
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (tab !== 'agreement') return;
    fetch(`${API}/agreement`)
      .then((res) => (res.ok ? (res.json() as Promise<Agreement>) : null))
      .then((data) => data && setAgreement(data))
      .catch(() => setError('Unable to load the agreement'));
  }, [tab]);

  useEffect(() => {
    setLinkResult(null);
    setRejectNote('');
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  async function act(path: string, method: string, body: unknown, done: string): Promise<unknown> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) throw new Error(await readMessage(res, 'That did not work'));
      const result = await res.json().catch(() => ({}));
      setMessage(done);
      await loadList();
      if (selected) await loadDetail(selected);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not work');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    const result = (await act(`/${id}/approve`, 'POST', null, 'Approved.')) as (LinkResult & { emailSent: boolean }) | null;
    if (result) {
      setLinkResult(result);
      setMessage(result.emailSent ? 'Approved. The onboarding email was sent.' : 'Approved. The email could not be sent, so copy the link below and send it to them yourself.');
    }
  }

  async function resend(id: string) {
    const result = (await act(`/${id}/resend`, 'POST', null, 'A new link was created.')) as LinkResult | null;
    if (result) {
      setLinkResult(result);
      setMessage(result.emailSent ? 'A new link was emailed. The old one no longer works.' : 'A new link was created, but the email could not be sent. Copy the link below and send it yourself. The old link no longer works.');
    }
  }

  function removeDocument(id: string, label: string) {
    if (!window.confirm(`Delete this ${label} from the site? The advisor can submit it again. Make sure you have saved a copy first.`)) return;
    void act(`/documents/${id}`, 'DELETE', null, 'The document was deleted.');
  }

  async function addEmailedForm(id: string) {
    if (!addFile) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('file', addFile);
      const res = await fetch(`${API}/${id}/documents/${addType}`, { method: 'POST', body });
      if (!res.ok) throw new Error(await readMessage(res, 'The form could not be added'));
      setAddFile(null);
      setMessage('The form was added and stored with the advisor\'s other forms.');
      await loadList();
      await loadDetail(id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The form could not be added');
    } finally {
      setBusy(false);
    }
  }

  async function saveAgreement(event: FormEvent) {
    event.preventDefault();
    if (!agreement) return;
    const saved = (await act('/agreement', 'PUT', agreement, 'Agreement saved. New signatures use this wording.')) as Agreement | null;
    if (saved) setAgreement(saved);
  }

  const field = 'mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm';
  const tabs: [typeof tab, string][] = [
    ['PENDING', `Waiting${list ? ` (${list.counts.PENDING})` : ''}`],
    ['APPROVED', `Approved${list ? ` (${list.counts.APPROVED})` : ''}`],
    ['REJECTED', 'Rejected'],
    ['CANCELLED', 'Cancelled'],
    ['all', 'All'],
    ['agreement', 'Agreement & forms'],
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold">Advisor applications</h1>
        <p className="mt-1 text-sm text-gray-600">
          People who applied on the Become an Advisor page. Approve an application to create their account and email them a link to start onboarding.
          Applications are at <code className="rounded bg-gray-100 px-1">/become-an-advisor</code>.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setSelected(null); setError(''); setMessage(''); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-purple-700 text-purple-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'agreement' ? (
        agreement && (
          <form onSubmit={saveAgreement} className="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">
              The Advisor Agreement advisors read and sign during onboarding. A signed copy keeps the wording it was signed with, so changes here only
              affect advisors who sign from now on. Start a heading with <code className="rounded bg-gray-100 px-1">## </code> and a bullet with{' '}
              <code className="rounded bg-gray-100 px-1">- </code>; separate paragraphs with a blank line. The acknowledgement, advisor details and
              signature lines are added automatically.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Title
              <input value={agreement.title} onChange={(event) => setAgreement({ ...agreement, title: event.target.value })} maxLength={150} required className={field} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Agreement text
              <textarea value={agreement.body} onChange={(event) => setAgreement({ ...agreement, body: event.target.value })} rows={22} required className={`${field} font-mono`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Authorized representative (printed on the agreement)
                <input value={agreement.representativeName} onChange={(event) => setAgreement({ ...agreement, representativeName: event.target.value })} maxLength={120} className={field} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Representative&apos;s title
                <input value={agreement.representativeTitle} onChange={(event) => setAgreement({ ...agreement, representativeTitle: event.target.value })} maxLength={120} className={field} />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Email address for signed forms (optional)
              <input type="email" value={agreement.formsEmail} onChange={(event) => setAgreement({ ...agreement, formsEmail: event.target.value })} maxLength={254} className={field} placeholder="onboarding@yourdomain.com" />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Shown to advisors in the W-9 step as another way to send their signed form. When one arrives, open the advisor here and use &ldquo;Add a form received by email&rdquo;.
              </span>
            </label>
            <p className="text-xs text-gray-500">The company signature and date lines are left blank on the agreement PDF for you to sign.</p>
            <button type="submit" disabled={busy} className="rounded bg-purple-700 px-5 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50">
              Save agreement
            </button>
          </form>
        )
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Experience</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Onboarding</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list?.applications.map((row) => (
                  <tr key={row.id} onClick={() => setSelected(row.id === selected ? null : row.id)} className={`cursor-pointer hover:bg-gray-50 ${row.id === selected ? 'bg-purple-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-gray-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3">{row.yearsExperience} yr{row.yearsExperience === 1 ? '' : 's'}</td>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === 'CANCELLED' ? (
                        <span className="text-red-700">Cancelled</span>
                      ) : row.status === 'APPROVED' && !row.onboarding ? (
                        <span className="text-amber-700">Account missing</span>
                      ) : row.onboarding ? (
                        row.onboarding.completed ? (
                          <span className="font-medium text-emerald-700">Complete</span>
                        ) : (
                          <span className="text-gray-700">
                            {row.onboarding.done} of {row.onboarding.total} steps{!row.onboarding.activated && <span className="text-amber-700"> · link not used yet</span>}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {list && list.applications.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-gray-500">
                      Nothing here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {detail && (
            <section className="space-y-5 rounded-lg border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{detail.name}</h2>
                  <p className="text-sm text-gray-600">
                    {detail.email} · {detail.phone} · {detail.yearsExperience} year{detail.yearsExperience === 1 ? '' : 's'} of experience
                  </p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Close
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Gifts &amp; experience</h3>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-800">{detail.gifts}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Reading style</h3>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm text-gray-800">{detail.readingStyle}</p>
                </div>
              </div>

              {(detail.status === 'PENDING' || detail.status === 'REJECTED') && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-gray-50 p-4">
                  <button type="button" disabled={busy} onClick={() => void approve(detail.id)} className="rounded bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                    Approve and email the onboarding link
                  </button>
                  {detail.status === 'PENDING' && (
                    <>
                      <label className="block min-w-48 flex-1 text-sm font-medium text-gray-700">
                        Note about declining (only you see it)
                        <input value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} maxLength={500} className={field} />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => window.confirm('Reject this application? Nothing is sent to the applicant.') && void act(`/${detail.id}/reject`, 'POST', { note: rejectNote }, 'Rejected.')}
                        className="rounded border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {detail.reviewNote && <p className="w-full text-sm text-gray-600">Note: {detail.reviewNote}</p>}
                </div>
              )}

              {linkResult && (
                <div className={`rounded-lg border p-4 text-sm ${linkResult.emailSent ? 'border-emerald-200 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
                  <p className="font-medium">{linkResult.emailSent ? 'The onboarding email was sent.' : 'The email was not sent (the site has no email server set up).'} The link, which works until {new Date(linkResult.linkExpiresAt).toLocaleDateString()}:</p>
                  <input readOnly value={linkResult.link} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-xs" />
                  <p className="mt-2 text-xs text-gray-600">This link is shown only now. To email automatically, set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in the site&apos;s environment.</p>
                </div>
              )}

              {(detail.status === 'APPROVED' || detail.status === 'CANCELLED') && !detail.onboarding && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <p className="font-medium text-amber-900">
                    {detail.status === 'CANCELLED' ? 'This application was cancelled, and there is no advisor account for it.' : 'This application was approved, but there is no advisor account for it now.'}
                  </p>
                  <p className="text-sm text-amber-900">The account was probably deleted from the Users page. You can approve it again to create a new account and email a fresh link, or cancel it.</p>
                  {detail.reviewNote && <p className="text-sm text-amber-900">Note: {detail.reviewNote}</p>}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={busy} onClick={() => void approve(detail.id)} className="rounded bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
                      Approve again and email the onboarding link
                    </button>
                    {detail.status === 'APPROVED' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => window.confirm('Mark this application as cancelled?') && void act(`/${detail.id}/cancel`, 'POST', {}, 'The application was cancelled.')}
                        className="rounded border border-red-300 bg-white px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel this application
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detail.status === 'CANCELLED' && detail.onboarding && (
                <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="font-medium text-red-900">
                    This onboarding was cancelled{detail.onboarding.cancelledAt ? ` on ${new Date(detail.onboarding.cancelledAt).toLocaleDateString()}` : ''}.
                  </p>
                  {detail.onboarding.cancelReason && <p className="text-sm text-red-900">Reason: {detail.onboarding.cancelReason}</p>}
                  <p className="text-sm text-red-900">
                    Their link no longer works and their account is locked: they cannot sign in or go live. Anything they submitted is still stored below until you delete it.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => window.confirm('Reopen this onboarding? Their account is unlocked once they use a new link to set a password.') && void resend(detail.id)}
                    className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    Reopen onboarding and send a new link
                  </button>
                </div>
              )}

              {(detail.status === 'APPROVED' || detail.status === 'CANCELLED') && detail.onboarding && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Onboarding</h3>
                    {detail.status === 'APPROVED' && !detail.onboarding.completedAt && (
                      <div className="flex flex-wrap items-center gap-3">
                      <button type="button" disabled={busy} onClick={() => void resend(detail.id)} className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
                        Send the link again
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Cancel this onboarding? Their link stops working and their account is locked; what they submitted is kept. You can reopen it later.\n\nReason (optional, only you see it):');
                          if (reason !== null) void act(`/${detail.id}/cancel`, 'POST', { note: reason }, 'Onboarding cancelled. The account is locked.');
                        }}
                        className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Cancel onboarding
                      </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {detail.status === 'CANCELLED'
                      ? 'Their progress when it was cancelled is shown below.'
                      : detail.onboarding.completedAt
                      ? `Finished on ${new Date(detail.onboarding.completedAt).toLocaleDateString()}.`
                      : detail.onboarding.activatedAt
                        ? `They created their password on ${new Date(detail.onboarding.activatedAt).toLocaleDateString()}.`
                        : `They have not opened the link yet${detail.onboarding.emailSentAt ? ` (emailed ${new Date(detail.onboarding.emailSentAt).toLocaleDateString()})` : ' (the email was not sent)'}. The link works until ${new Date(detail.onboarding.linkExpiresAt).toLocaleDateString()}.`}
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {detail.onboarding.steps.map((step) => (
                      <li key={step.key} className="flex items-start gap-3 rounded border px-3 py-2 text-sm">
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${step.done ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{step.done ? '✓' : ''}</span>
                        <span>
                          <span className="font-medium">{step.label}</span>
                          {step.detail && <span className="block text-xs text-gray-500">{step.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Forms submitted</h4>
                    <p className="mb-2 text-xs text-gray-500">Stored encrypted. Each download is recorded in the audit log.</p>
                    <ul className="divide-y rounded border">
                      {detail.documents.map((doc) => (
                        <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span>
                            <span className="font-medium">{TYPE_LABEL[doc.type] ?? doc.type}</span>
                            <span className="text-gray-500">
                              {' '}
                              · {doc.source === 'ONLINE' ? 'completed on the site' : doc.source === 'ADMIN_UPLOAD' ? 'received by email' : 'uploaded by the advisor'} · {kb(doc.sizeBytes)} · {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            {doc.supersededAt && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">replaced</span>}
                          </span>
                          <span className="flex items-center gap-3">
                            <a href={`${API}/documents/${doc.id}`} className="font-medium text-purple-700 underline">
                              Download
                            </a>
                            <button type="button" disabled={busy} onClick={() => removeDocument(doc.id, TYPE_LABEL[doc.type] ?? 'document')} className="text-red-700 underline disabled:opacity-50">
                              Delete
                            </button>
                          </span>
                        </li>
                      ))}
                      {detail.documents.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">Nothing submitted yet.</li>}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded border bg-gray-50 p-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Add a form received by email
                        <select value={addType} onChange={(event) => setAddType(event.target.value)} className={field}>
                          <option value="W9">Signed W-9</option>
                          <option value="AGREEMENT">Signed Advisor Agreement</option>
                          <option value="DIRECT_DEPOSIT">Direct Deposit form</option>
                        </select>
                      </label>
                      <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setAddFile(event.target.files?.[0] ?? null)} className="text-sm" />
                      <button type="button" disabled={busy || !addFile} onClick={() => void addEmailedForm(detail.id)} className="rounded border px-4 py-2 text-sm hover:bg-white disabled:opacity-50">
                        Add form
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
