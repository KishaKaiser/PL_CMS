'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';

type ReportFormData = {
  fullName: string;
  birthDate: string;
  birthTime: string;
  timeUnknown?: boolean;
  lifeEvents?: Array<{ description: string; date: string }>;
  birthCity: string;
  birthState: string;
  birthCountry: string;
  birthLatitude?: number | null;
  birthLongitude?: number | null;
  timezone?: string | null;
  notes?: string | null;
};

type ReportRecord = {
  id: string;
  status: string;
  formData: ReportFormData;
  reportUrl: string | null;
  fileName: string | null;
  errorMessage: string | null;
  submittedAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; name: string };
  order: { id: string; status: string; createdAt: string };
};

const STATUS_FILTERS = ['ALL', 'PENDING', 'READY', 'FAILED'] as const;

export default function AstrologyOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('PENDING');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploadFiles, setUploadFiles] = useState<Record<string, File | undefined>>({});
  const [failReasons, setFailReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const res = await fetch(`/api/proxy/astrology/reports${query}`);
      if (!res.ok) throw new Error('Failed to load astrology orders.');
      setReports((await res.json()) as ReportRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load astrology orders.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  function handleFileChange(reportId: string, event: ChangeEvent<HTMLInputElement>) {
    setUploadFiles((current) => ({ ...current, [reportId]: event.target.files?.[0] }));
  }

  async function handleUpload(reportId: string) {
    const file = uploadFiles[reportId];
    if (!file) {
      setError('Choose a PDF file to upload first.');
      return;
    }
    setBusyId(reportId);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/proxy/astrology/reports/${reportId}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Upload failed.');
      }
      setMessage('Report uploaded — it is now available to the client under Downloads.');
      setUploadFiles((current) => ({ ...current, [reportId]: undefined }));
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkFailed(reportId: string) {
    const reason = failReasons[reportId]?.trim();
    if (!reason) {
      setError('Enter a reason before marking this report as failed.');
      return;
    }
    setBusyId(reportId);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/astrology/reports/${reportId}/fail`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Could not update the report.');
      }
      setMessage('Report marked as failed.');
      setFailReasons((current) => ({ ...current, [reportId]: '' }));
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the report.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Orders</h1>
          <p className="mt-2 text-sm text-gray-600">
            Purchased astrology reports awaiting fulfillment. Run each chart through the astrology app, then upload the
            finished PDF here — it will appear under the client&apos;s Downloads.
          </p>
        </header>

        <div className="flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                statusFilter === filter ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              } border border-gray-200`}
            >
              {filter}
            </button>
          ))}
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-500">No orders match this filter.</p>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="rounded border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-950">
                      {report.user.name} <span className="font-normal text-gray-500">({report.user.email})</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {report.product.name} · Order #{report.order.id.slice(0, 12)} ·{' '}
                      {new Date(report.order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                    {report.status}
                  </span>
                </div>

                {typeof report.formData === 'object' && report.formData?.fullName ? (
                  <>
                    <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      <Field label="Name" value={report.formData.fullName} />
                      <Field label="Birth Date" value={report.formData.birthDate} />
                      {!report.formData.timeUnknown && <Field label="Birth Time" value={report.formData.birthTime} />}
                      <Field
                        label="Birthplace"
                        value={[report.formData.birthCity, report.formData.birthState, report.formData.birthCountry]
                          .filter(Boolean)
                          .join(', ')}
                      />
                      {report.formData.notes && <Field label="Notes" value={report.formData.notes} />}
                    </dl>
                    {report.formData.timeUnknown && (report.formData.lifeEvents?.length ?? 0) > 0 && (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Exact birth time unknown — significant life events provided
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-gray-800">
                          {report.formData.lifeEvents!.map((event, index) => (
                            <li key={index}>
                              <span className="font-medium">{event.date}</span> — {event.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-4 text-sm text-amber-700">Birth data could not be read for this report.</p>
                )}

                {report.errorMessage && (
                  <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{report.errorMessage}</p>
                )}

                {report.reportUrl ? (
                  <a
                    href={report.reportUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                  >
                    View Uploaded PDF
                  </a>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(event) => handleFileChange(report.id, event)}
                      className="text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUpload(report.id)}
                      disabled={busyId === report.id}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                      {busyId === report.id ? 'Uploading...' : 'Upload PDF'}
                    </button>
                    <input
                      type="text"
                      placeholder="Reason if this order can't be fulfilled"
                      value={failReasons[report.id] ?? ''}
                      onChange={(event) => setFailReasons((current) => ({ ...current, [report.id]: event.target.value }))}
                      className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleMarkFailed(report.id)}
                      disabled={busyId === report.id}
                      className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark Failed
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value || '—'}</dd>
    </div>
  );
}
