'use client';

import { FormEvent, useState } from 'react';

const EVENT_TYPES = [
  'wedding', 'business_launch', 'surgery', 'travel', 'signing_contract',
  'moving', 'investment', 'interview', 'first_date', 'proposal', 'purchase', 'creative_project',
];

type ElectionalResult = {
  id: string;
  resultData: {
    results: Array<{ date: string; time: string; score: number; recommendation: string; strengths: string[]; weaknesses: string[]; moonPhase: string }>;
    bestDate: { date: string; time: string; score: number } | null;
  };
};

export default function ElectionalPage() {
  const [eventType, setEventType] = useState('wedding');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState('-05:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ElectionalResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/electional', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventType,
          startDate,
          endDate,
          location,
          latitude: Number(latitude),
          longitude: Number(longitude),
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Electional analysis could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Electional analysis could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Electional Astrology</h1>
          <p className="mt-2 text-sm text-gray-600">Scan a date range to find the best-timed moment for an event (max 90 days).</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <label className="block text-sm font-medium text-gray-700">
            Event Type
            <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Start Date
              <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              End Date
              <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Location
            <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="New York, NY, USA" className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-sm font-medium text-gray-700">
              Latitude
              <input required type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Longitude
              <input required type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Timezone
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="-05:00" />
            </label>
          </div>
          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Scanning dates...' : 'Find Best Timing'}
          </button>
        </form>

        {result && (
          <section className="space-y-4 rounded border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Top Candidate Times</h3>
              <a href={`/api/proxy/astrology/charts/${result.id}/pdf`} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Export PDF
              </a>
            </div>
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Moon Phase</th>
                    <th className="px-3 py-2">Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.resultData.results.map((candidate, index) => (
                    <tr key={index} className={candidate === result.resultData.bestDate ? 'bg-indigo-50' : undefined}>
                      <td className="px-3 py-2 font-medium text-gray-950">{candidate.date}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{candidate.time}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{candidate.score}</td>
                      <td className="px-3 py-2 text-gray-700">{candidate.moonPhase}</td>
                      <td className="px-3 py-2 text-gray-600">{candidate.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
