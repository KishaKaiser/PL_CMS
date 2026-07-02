'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type FormType = 'CONTACT' | 'REGISTRATION';
type FormStatus = 'DRAFT' | 'PUBLISHED';
type FieldType = 'text' | 'email' | 'password' | 'textarea' | 'select' | 'checkbox';

interface CmsFormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface CmsForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: FormType;
  status: FormStatus;
  fields: CmsFormField[];
  settings: Record<string, unknown>;
  successMessage: string;
  createdAt: string;
  updatedAt: string;
  _count?: { submissions: number };
}

interface FormSubmission {
  id: string;
  data: Record<string, unknown>;
  status: string;
  userId: string | null;
  createdAt: string;
}

const emptyContactFields: CmsFormField[] = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'message', label: 'Message', type: 'textarea', required: true },
];

const emptyRegistrationFields: CmsFormField[] = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'username', label: 'Username', type: 'text', required: false },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'password', label: 'Password', type: 'password', required: true },
];

const emptyForm: Omit<CmsForm, 'id' | 'createdAt' | 'updatedAt' | '_count'> = {
  slug: '',
  title: '',
  description: '',
  type: 'CONTACT',
  status: 'DRAFT',
  fields: emptyContactFields,
  settings: {},
  successMessage: 'Thank you. Your submission has been received.',
};

export default function AdminFormsPage() {
  const [forms, setForms] = useState<CmsForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creatingNew, setCreatingNew] = useState(false);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedForm = useMemo(
    () => forms.find((entry) => entry.id === selectedFormId) ?? null,
    [forms, selectedFormId],
  );

  const publicUrl = form.slug ? `/forms/${form.slug}` : '/forms/your-form';

  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/admin/forms');
      if (!res.ok) throw new Error('Could not load forms');
      const data = (await res.json()) as CmsForm[];
      setForms(data);
      if (!selectedFormId && !creatingNew && data[0]) setSelectedFormId(data[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load forms');
    } finally {
      setLoading(false);
    }
  }, [creatingNew, selectedFormId]);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    if (!selectedForm) return;
    setForm({
      slug: selectedForm.slug,
      title: selectedForm.title,
      description: selectedForm.description ?? '',
      type: selectedForm.type,
      status: selectedForm.status,
      fields: normalizeFields(selectedForm.fields, selectedForm.type),
      settings: selectedForm.settings ?? {},
      successMessage: selectedForm.successMessage,
    });
    void fetchSubmissions(selectedForm.id);
  }, [selectedForm]);

  async function fetchSubmissions(formId: string) {
    try {
      const res = await fetch(`/api/proxy/admin/forms/${formId}/submissions`);
      if (!res.ok) throw new Error('Could not load submissions');
      setSubmissions((await res.json()) as FormSubmission[]);
    } catch {
      setSubmissions([]);
    }
  }

  function startNew(type: FormType) {
    setCreatingNew(true);
    setSelectedFormId(null);
    setSubmissions([]);
    setMessage('');
    setError('');
    setForm({
      ...emptyForm,
      type,
      title: type === 'REGISTRATION' ? 'New Registration Form' : 'New Contact Form',
      slug: type === 'REGISTRATION' ? 'registration' : 'contact',
      fields: type === 'REGISTRATION' ? emptyRegistrationFields : emptyContactFields,
      settings: type === 'REGISTRATION' ? { createUser: true, defaultRole: 'CLIENT' } : {},
      successMessage:
        type === 'REGISTRATION'
          ? 'Your account has been created.'
          : 'Thank you. Your submission has been received.',
    });
  }

  async function saveForm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        ...form,
        slug: slugify(form.slug || form.title),
        fields: form.fields.map((field) => ({
          ...field,
          id: slugify(field.id || field.label),
          options: field.options ?? [],
        })),
      };
      const url = selectedFormId ? `/api/proxy/admin/forms/${selectedFormId}` : '/api/proxy/admin/forms';
      const res = await fetch(url, {
        method: selectedFormId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? 'Could not save form');
      }
      const saved = (await res.json()) as CmsForm;
      setCreatingNew(false);
      setSelectedFormId(saved.id);
      setMessage('Form saved.');
      await fetchForms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save form');
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm() {
    if (!selectedFormId || !confirm('Delete this form and all submissions?')) return;
    setError('');
    try {
      const res = await fetch(`/api/proxy/admin/forms/${selectedFormId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete form');
      setSelectedFormId(null);
      setCreatingNew(false);
      setForm(emptyForm);
      setSubmissions([]);
      await fetchForms();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete form');
    }
  }

  function updateField(index: number, nextField: Partial<CmsFormField>) {
    setForm((current) => ({
      ...current,
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...nextField } : field,
      ),
    }));
  }

  function addField() {
    setForm((current) => ({
      ...current,
      fields: [
        ...current.fields,
        { id: `field-${current.fields.length + 1}`, label: 'New Field', type: 'text', required: false },
      ],
    }));
  }

  function removeField(index: number) {
    setForm((current) => ({
      ...current,
      fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index),
    }));
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Forms</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create contact forms, registration forms, and review form submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => startNew('CONTACT')} className="rounded border bg-white px-4 py-2 text-sm hover:bg-gray-50">
            New Contact Form
          </button>
          <button type="button" onClick={() => startNew('REGISTRATION')} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            New Registration Form
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Installed Forms</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading forms...</p>
          ) : forms.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No forms created yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {forms.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setCreatingNew(false);
                    setSelectedFormId(entry.id);
                  }}
                  className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                    selectedFormId === entry.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="block font-medium text-gray-900">{entry.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {entry.type === 'REGISTRATION' ? 'Registration' : 'Contact'} · {entry.status.toLowerCase()} · {entry._count?.submissions ?? 0} submissions
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="space-y-6">
          <form onSubmit={saveForm} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedFormId ? 'Edit Form' : 'Create Form'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Public URL: {publicUrl}</p>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Form'}
                </button>
                {selectedFormId && (
                  <button type="button" onClick={deleteForm} className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Form title
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                      slug: current.slug || slugify(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Form URL slug
                <input
                  required
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Type
                <select
                  value={form.type}
                  onChange={(event) => {
                    const type = event.target.value as FormType;
                    setForm((current) => ({
                      ...current,
                      type,
                      fields: type === 'REGISTRATION' ? emptyRegistrationFields : emptyContactFields,
                      settings: type === 'REGISTRATION' ? { createUser: true, defaultRole: 'CLIENT' } : {},
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="CONTACT">Contact form</option>
                  <option value="REGISTRATION">Registration form</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FormStatus }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Description
              <textarea
                value={form.description ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-gray-700">
              Success message
              <input
                value={form.successMessage}
                onChange={(event) => setForm((current) => ({ ...current, successMessage: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>

            {form.type === 'REGISTRATION' && (
              <section className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold text-gray-900">Registration Settings</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.settings.createUser !== false}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          settings: { ...current.settings, createUser: event.target.checked },
                        }))
                      }
                    />
                    Create user account after submit
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    New user role
                    <select
                      value={String(form.settings.defaultRole ?? 'CLIENT')}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          settings: { ...current.settings, defaultRole: event.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="CLIENT">Client</option>
                      <option value="ADVISOR">Advisor</option>
                      <option value="EDITOR">Editor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                </div>
              </section>
            )}

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Form Fields</h3>
                <button type="button" onClick={addField} className="rounded border bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
                  Add Field
                </button>
              </div>
              <div className="space-y-3">
                {form.fields.map((field, index) => (
                  <div key={`${field.id}-${index}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_160px_120px_auto] md:items-end">
                      <label className="block text-sm font-medium text-gray-700">
                        Label
                        <input
                          value={field.label}
                          onChange={(event) => updateField(index, { label: event.target.value, id: slugify(event.target.value) })}
                          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-sm font-medium text-gray-700">
                        Type
                        <select
                          value={field.type}
                          onChange={(event) => updateField(index, { type: event.target.value as FieldType })}
                          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="password">Password</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Dropdown</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) => updateField(index, { required: event.target.checked })}
                        />
                        Required
                      </label>
                      <button type="button" onClick={() => removeField(index)} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Placeholder
                        <input
                          value={field.placeholder ?? ''}
                          onChange={(event) => updateField(index, { placeholder: event.target.value })}
                          className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                        />
                      </label>
                      {field.type === 'select' && (
                        <label className="block text-sm font-medium text-gray-700">
                          Dropdown options
                          <input
                            value={(field.options ?? []).join(', ')}
                            onChange={(event) =>
                              updateField(index, {
                                options: event.target.value.split(',').map((option) => option.trim()).filter(Boolean),
                              })
                            }
                            className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </form>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Submissions</h2>
                <p className="text-sm text-gray-500">{submissions.length} submissions for this form</p>
              </div>
              {selectedFormId && (
                <button type="button" onClick={() => void fetchSubmissions(selectedFormId)} className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50">
                  Refresh
                </button>
              )}
            </div>
            {submissions.length === 0 ? (
              <p className="text-sm text-gray-500">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Submission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((submission) => (
                      <tr key={submission.id}>
                        <td className="px-3 py-3 text-gray-500">{new Date(submission.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">{submission.status}</span>
                        </td>
                        <td className="px-3 py-3">
                          <pre className="max-w-xl whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">
                            {JSON.stringify(submission.data, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function normalizeFields(fields: CmsFormField[] | unknown, type: FormType): CmsFormField[] {
  if (!Array.isArray(fields) || fields.length === 0) {
    return type === 'REGISTRATION' ? emptyRegistrationFields : emptyContactFields;
  }
  return fields.map((field, index) => ({
    id: String(field.id || `field-${index + 1}`),
    label: String(field.label || `Field ${index + 1}`),
    type: isFieldType(field.type) ? field.type : 'text',
    required: Boolean(field.required),
    placeholder: typeof field.placeholder === 'string' ? field.placeholder : '',
    options: Array.isArray(field.options) ? field.options.map(String) : [],
  }));
}

function isFieldType(value: unknown): value is FieldType {
  return ['text', 'email', 'password', 'textarea', 'select', 'checkbox'].includes(String(value));
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
