'use client';

import { useCallback, useEffect, useState } from 'react';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type HoroscopeRecord = {
  id: string;
  sign: string;
  overview: string;
  career: string;
  money: string;
  love: string;
  generatedAt: string;
};

export default function AdminHoroscopesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<Array<HoroscopeRecord | null>>([]);
  const [drafts, setDrafts] = useState<Record<string, Partial<HoroscopeRecord>>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/astrology/horoscopes?year=${year}&month=${month}`);
      if (!res.ok) throw new Error('Failed to load horoscopes.');
      setEntries((await res.json()) as Array<HoroscopeRecord | null>);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load horoscopes.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  async function handleGenerateAll() {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/proxy/astrology/horoscopes/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year, month }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Could not start generation.');
      }
      setMessage(
        'Generation started in the background for all 12 signs. This can take several minutes — refresh below to check progress.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start generation.');
    } finally {
      setGenerating(false);
    }
  }

  function updateDraft(id: string, field: keyof HoroscopeRecord, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  }

  async function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    setError('');
    try {
      const res = await fetch(`/api/proxy/astrology/horoscopes/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Save failed.');
      }
      setMessage('Saved.');
      await fetchEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Horoscopes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Monthly horoscopes for all 12 signs (career, money, love) generate automatically on the 1st of each month.
            Use Generate Now to backfill a month, and edit any section below before it goes live on /horoscopes.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-white p-4">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>{name}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void fetchEntries()}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateAll()}
            disabled={generating}
            className="ml-auto rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {generating ? 'Starting...' : 'Generate Now (all 12 signs)'}
          </button>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {ZODIAC_SIGNS.map((sign, index) => {
              const entry = entries[index];
              const draft = entry ? drafts[entry.id] : undefined;
              return (
                <div key={sign} className="rounded border border-gray-200 bg-white p-4">
                  <h2 className="mb-2 font-semibold text-gray-950">{sign}</h2>
                  {entry ? (
                    <div className="space-y-2">
                      <LabeledTextarea
                        label="Overview"
                        value={draft?.overview ?? entry.overview}
                        onChange={(value) => updateDraft(entry.id, 'overview', value)}
                      />
                      <LabeledTextarea
                        label="Career"
                        value={draft?.career ?? entry.career}
                        onChange={(value) => updateDraft(entry.id, 'career', value)}
                      />
                      <LabeledTextarea
                        label="Money"
                        value={draft?.money ?? entry.money}
                        onChange={(value) => updateDraft(entry.id, 'money', value)}
                      />
                      <LabeledTextarea
                        label="Love & Relationships"
                        value={draft?.love ?? entry.love}
                        onChange={(value) => updateDraft(entry.id, 'love', value)}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSave(entry.id)}
                        disabled={!draft || savingId === entry.id}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {savingId === entry.id ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Not generated yet for this month.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
      />
    </label>
  );
}
