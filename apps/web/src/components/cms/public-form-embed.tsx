'use client';

import { useEffect, useMemo, useState } from 'react';

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
  slug: string;
  title: string;
  description: string | null;
  type: 'CONTACT' | 'REGISTRATION';
  fields: CmsFormField[];
  successMessage: string;
}

export function PublicFormEmbed({ slug, fallbackTitle, showTitle = true }: { slug: string; fallbackTitle?: string; showTitle?: boolean }) {
  const [form, setForm] = useState<CmsForm | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(Boolean(slug));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fields = useMemo(() => normalizeFields(form?.fields), [form?.fields]);

  useEffect(() => {
    async function loadForm() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/proxy/forms/${slug}`);
        if (!res.ok) throw new Error('Form not found');
        const data = (await res.json()) as CmsForm;
        setForm(data);
        setValues(buildEmptyValues(normalizeFields(data.fields)));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Form not found');
      } finally {
        setLoading(false);
      }
    }

    if (slug) void loadForm();
  }, [slug]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/proxy/forms/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: values }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? 'Could not submit form');
      setMessage(body.message ?? form?.successMessage ?? 'Submitted.');
      setValues(buildEmptyValues(fields));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit form');
    } finally {
      setSubmitting(false);
    }
  }

  if (!slug) {
    return <div className="mb-6 rounded border border-dashed p-6 text-sm text-gray-500">No form selected.</div>;
  }

  if (loading) {
    return <div className="mb-6 rounded border p-6 text-sm text-gray-500">Loading form...</div>;
  }

  if (!form) {
    return <div className="mb-6 rounded bg-red-50 p-4 text-sm text-red-600">{error || 'Form not found'}</div>;
  }

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {showTitle && <h2 className="text-2xl font-semibold text-gray-950">{form.title || fallbackTitle}</h2>}
      {form.description && <p className="mt-2 text-sm text-gray-600">{form.description}</p>}
      {error && <p className="mt-4 rounded bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 rounded bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
      <form onSubmit={submit} className="mt-5 space-y-4">
        {fields.map((field) => (
          <EmbeddedFormField
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
          />
        ))}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : form.type === 'REGISTRATION' ? 'Create Account' : 'Submit'}
        </button>
      </form>
    </section>
  );
}

function EmbeddedFormField({
  field,
  value,
  onChange,
}: {
  field: CmsFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <>
      {field.label}
      {field.required && <span className="text-red-600"> *</span>}
    </>
  );

  if (field.type === 'textarea') {
    return (
      <label className="block text-sm font-medium text-gray-700">
        {label}
        <textarea required={field.required} value={String(value ?? '')} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="block text-sm font-medium text-gray-700">
        {label}
        <select required={field.required} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">Choose...</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {label}
      </label>
    );
  }

  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input required={field.required} type={field.type} value={String(value ?? '')} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
    </label>
  );
}

function normalizeFields(fields: CmsFormField[] | undefined): CmsFormField[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((field, index) => ({
    id: String(field.id || `field-${index + 1}`),
    label: String(field.label || `Field ${index + 1}`),
    type: isFieldType(field.type) ? field.type : 'text',
    required: Boolean(field.required),
    placeholder: field.placeholder ?? '',
    options: Array.isArray(field.options) ? field.options.map(String) : [],
  }));
}

function buildEmptyValues(fields: CmsFormField[]) {
  return fields.reduce<Record<string, unknown>>((result, field) => {
    result[field.id] = field.type === 'checkbox' ? false : '';
    return result;
  }, {});
}

function isFieldType(value: unknown): value is FieldType {
  return ['text', 'email', 'password', 'textarea', 'select', 'checkbox'].includes(String(value));
}
