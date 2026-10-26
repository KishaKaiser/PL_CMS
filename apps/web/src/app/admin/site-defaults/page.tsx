'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import {
  SITE_FONT_CHOICES,
  SITE_NUMBER_LIMITS,
  type SiteDefaultField,
  type SiteNumberField,
  type SiteDefaultOverrides,
  type SiteDefaults,
  type SiteDefaultsState,
} from '@pl-cms/shared';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm';

type ColorField = Extract<
  SiteDefaultField,
  'primaryColor' | 'accentColor' | 'textColor' | 'backgroundColor' | 'buttonBackground' | 'buttonText' | 'buttonHoverBackground' | 'buttonHoverText'
>;
type FontField = Extract<SiteDefaultField, 'bodyFont' | 'headingFont' | 'buttonFont'>;

/**
 * The fonts, colors and button look the whole site falls back to. Each value shows what is in effect now. A value is only
 * saved once it has been changed here, so everything left alone keeps following the Theme Builder.
 */
export default function SiteDefaultsPage() {
  const [state, setState] = useState<SiteDefaultsState | null>(null);
  const [draft, setDraft] = useState<SiteDefaultOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/proxy/admin/site-defaults');
      if (!res.ok) throw new Error('Could not load the site defaults');
      const next = (await res.json()) as SiteDefaultsState;
      setState(next);
      setDraft(next.overrides);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load the site defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !state) return <div className="p-8 text-sm text-gray-500">Loading...</div>;
  if (!state) return <div className="p-8 text-sm text-red-600">{error || 'Could not load the site defaults'}</div>;

  const inherited = state.inherited;
  const current: SiteDefaults = { ...inherited, ...draft };
  const savedJson = JSON.stringify(state.overrides);
  const dirty = JSON.stringify(draft) !== savedJson;

  function change<K extends SiteDefaultField>(field: K, value: SiteDefaults[K]) {
    setDraft((existing) => ({ ...existing, [field]: value }));
    setMessage('');
  }

  function reset(field: SiteDefaultField) {
    setDraft((existing) => {
      const next = { ...existing };
      delete next[field];
      return next;
    });
    setMessage('');
  }

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/admin/site-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: draft }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Could not save the site defaults'));
      }
      const next = (await res.json()) as SiteDefaultsState;
      setState(next);
      setDraft(next.overrides);
      setMessage('Saved. Visitors will see the change within a minute.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the site defaults');
    } finally {
      setSaving(false);
    }
  }

  function colorField(field: ColorField, label: string, hint: string) {
    return (
      <Field key={field} label={label} hint={hint} changed={draft[field] !== undefined} onReset={() => reset(field)}>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="color"
            value={current[field]}
            onChange={(event) => change(field, event.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-gray-200 bg-white"
            aria-label={label}
          />
          <code className="text-xs text-gray-500">{current[field]}</code>
        </div>
      </Field>
    );
  }

  function fontField(field: FontField, label: string, hint: string) {
    const value = current[field];
    const known = value === '' || SITE_FONT_CHOICES.some((font) => font.value === value);
    return (
      <Field key={field} label={label} hint={hint} changed={draft[field] !== undefined} onReset={() => reset(field)}>
        <select value={value} onChange={(event) => change(field, event.target.value)} className={inputClass}>
          {field !== 'bodyFont' && <option value="">Same as the body font</option>}
          {!known && <option value={value}>Theme font ({value.split(',')[0]})</option>}
          {SITE_FONT_CHOICES.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </Field>
    );
  }

  function numberField(field: SiteNumberField, label: string, hint: string) {
    const [min, max] = SITE_NUMBER_LIMITS[field];
    return (
      <Field key={field} label={label} hint={hint || `Between ${min} and ${max}.`} changed={draft[field] !== undefined} onReset={() => reset(field)}>
        <input
          type="number"
          min={min}
          max={max}
          value={current[field]}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (event.target.value !== '' && Number.isFinite(value)) change(field, Math.min(max, Math.max(min, Math.round(value))));
          }}
          className={inputClass}
        />
      </Field>
    );
  }

  const previewBodyFont = current.bodyFont;
  const previewVariables = {
    '--site-button-size': `${current.buttonFontSize}px`,
    '--site-button-bg': current.buttonBackground,
    '--site-button-text': current.buttonText,
    '--site-button-hover-bg': current.buttonHoverBackground,
    '--site-button-hover-text': current.buttonHoverText,
    '--site-button-radius': `${current.buttonRadius}px`,
    '--site-button-font': current.buttonFont || previewBodyFont,
  } as CSSProperties;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Site Defaults</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            The fonts, colors and button look the whole site falls back to. Anything you leave alone keeps following your Theme
            Builder; use Reset on a value to go back to it.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-sm text-amber-700">Unsaved changes</span>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save defaults'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Fonts</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {fontField('bodyFont', 'Body font', 'All the text on public pages.')}
              {fontField('headingFont', 'Heading font', 'Headings on public pages. Headings given their own font in the page editor keep it.')}
              {fontField('buttonFont', 'Button font', 'Page-builder buttons and slider buttons that have no font of their own.')}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Text sizes (pixels)</h2>
            <p className="text-sm text-gray-500">
              Headings and text that have no size of their own. A heading or text block you gave a size in the page editor keeps
              that size, and small labels keep theirs.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {numberField('bodyFontSize', 'Normal text', '')}
              {numberField('h1FontSize', 'Heading 1', 'Page titles.')}
              {numberField('h2FontSize', 'Heading 2', 'Section headings.')}
              {numberField('h3FontSize', 'Heading 3', 'Smaller headings.')}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Colors</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {colorField('primaryColor', 'Primary color', 'Headings, links and prices. Buttons use their own color below once you set one.')}
              {colorField('accentColor', 'Accent color', 'Secondary highlights.')}
              {colorField('textColor', 'Text color', 'Normal text on public pages.')}
              {colorField('backgroundColor', 'Page background', 'Behind the content of public pages.')}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Buttons</h2>
            <p className="text-sm text-gray-500">
              Used by every button on the public site: page-builder buttons, the shop, cart, login and account buttons, the
              newsletter and form widgets, and slider buttons set to &quot;Use the site button style&quot; (the default for new
              ones). Corner rounding applies to page-builder and slider buttons; the others keep their own shape. A slider button
              you styled yourself keeps its own look until you switch that option on.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {colorField('buttonBackground', 'Button color', 'The button when nothing is touching it.')}
              {colorField('buttonText', 'Button text color', '')}
              {colorField('buttonHoverBackground', 'Button color on hover', 'When the mouse is over the button.')}
              {colorField('buttonHoverText', 'Button text color on hover', '')}
              {numberField('buttonFontSize', 'Button text size (pixels)', 'The size of the words on buttons.')}
              {numberField('buttonRadius', 'Corner rounding (pixels)', '0 is square; larger is rounder.')}
            </div>
          </section>
        </div>

        <aside className="order-first xl:order-none xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Preview</h2>
            <div className="rounded-lg border p-5" style={{ ...previewVariables, backgroundColor: current.backgroundColor, color: current.textColor, fontFamily: previewBodyFont }}>
              <h3 className="font-bold leading-tight" style={{ color: current.primaryColor, fontFamily: current.headingFont || undefined, fontSize: current.h2FontSize }}>
                A heading
              </h3>
              <p className="mt-2 leading-relaxed" style={{ fontSize: current.bodyFontSize }}>
                This is how normal text looks. A{' '}
                <span className="font-medium" style={{ color: current.primaryColor }}>
                  link or price
                </span>{' '}
                uses the primary color, and{' '}
                <span className="font-medium" style={{ color: current.accentColor }}>
                  highlights
                </span>{' '}
                use the accent color.
              </p>
              <a href="#preview" onClick={(event) => event.preventDefault()} className="site-button mt-4 inline-block px-4 py-2 text-center">
                A button (hover over me)
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  changed,
  onReset,
  children,
}: {
  label: string;
  hint: string;
  changed: boolean;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {changed ? (
          <button type="button" onClick={onReset} className="text-xs font-medium text-indigo-600 hover:underline">
            Reset
          </button>
        ) : (
          <span className="text-xs text-gray-400">Default</span>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
