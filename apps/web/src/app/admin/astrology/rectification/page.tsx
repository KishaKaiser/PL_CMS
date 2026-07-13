'use client';

import { FormEvent, useState } from 'react';

const EVENT_TYPES = ['marriage', 'child', 'career', 'relocation', 'accident', 'loss', 'education', 'financial', 'health', 'spiritual'];

type LifeEventForm = { type: string; date: string; description: string };

type RectificationResult = {
  resultData: Array<{ time: string; score: number; reasoning: string }>;
};

export default function RectificationPage() {
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('United States');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState('-05:00');
  const [events, setEvents] = useState<LifeEventForm[]>([{ type: 'career', date: '', description: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RectificationResult | null>(null);

  function updateEvent(index: number, patch: Partial<LifeEventForm>) {
    setEvents((current) => current.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  function addEvent() {
    setEvents((current) => [...current, { type: 'career', date: '', description: '' }]);
  }

  function removeEvent(index: number) {
    setEvents((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/rectification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          birthDate,
          city,
          state,
          country,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          timezone,
          events: events.filter((e) => e.date),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Birth time rectification could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Birth time rectification could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Birth Time Rectification</h1>
          <p className="mt-2 text-sm text-gray-600">Estimate an unknown birth time from a list of major life events, using AI-assisted reasoning (falls back to heuristic defaults if the AI is unavailable).</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <label className="block text-sm font-medium text-gray-700">
            Birth Date
            <input required type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Birth City
            <input required value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              State
              <input value={state} onChange={(e) => setState(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Country
              <input required value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Latitude
              <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="optional" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Longitude
              <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="optional" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Timezone
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Life Events</h3>
              <button type="button" onClick={addEvent} className="text-sm font-medium text-indigo-600 hover:underline">+ Add event</button>
            </div>
            {events.map((event, index) => (
              <div key={index} className="grid grid-cols-[140px_150px_1fr_auto] gap-2">
                <select value={event.type} onChange={(e) => updateEvent(index, { type: e.target.value })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input type="date" value={event.date} onChange={(e) => updateEvent(index, { date: e.target.value })} className="rounded border border-gray-300 px-2 py-2 text-sm" />
                <input value={event.description} onChange={(e) => updateEvent(index, { description: e.target.value })} placeholder="Description (optional)" className="rounded border border-gray-300 px-2 py-2 text-sm" />
                <button type="button" onClick={() => removeEvent(index)} className="rounded px-2 text-sm text-red-700 hover:bg-red-50">Remove</button>
              </div>
            ))}
          </div>

          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Analyzing...' : 'Estimate Birth Time'}
          </button>
        </form>

        {result && (
          <section className="space-y-3 rounded border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Candidate Birth Times</h3>
            {result.resultData.map((candidate, index) => (
              <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                <p className="font-semibold text-gray-950">{candidate.time} — confidence {candidate.score}%</p>
                <p className="mt-1 text-gray-600">{candidate.reasoning}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
