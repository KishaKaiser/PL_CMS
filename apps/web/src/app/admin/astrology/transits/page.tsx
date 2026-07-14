'use client';

import { FormEvent, useState } from 'react';
import { BirthDataFields, emptyBirthData, toBirthDataPayload, type BirthDataFormState } from '../../../../components/astrology/birth-data-fields';
import { ChartWheel } from '../../../../components/astrology/chart-wheel';

type TransitResult = {
  id: string;
  chartData: { natal: any };
  resultData: {
    planets: Array<{ name: string; sign: string; degree: number; house: number }>;
    aspects: Array<{ transitPlanet: string; natalPlanet: string; type: string; orb: number }>;
  };
};

export default function TransitsPage() {
  const [birthData, setBirthData] = useState<BirthDataFormState>(emptyBirthData);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TransitResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/transits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ birthData: toBirthDataPayload(birthData), asOfDate: `${asOfDate}T12:00:00.000Z` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Transit report could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transit report could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Transits</h1>
          <p className="mt-2 text-sm text-gray-600">See how current (or a chosen date's) planetary positions aspect a natal chart.</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <BirthDataFields label="Birth Data" value={birthData} onChange={setBirthData} />
          <label className="block text-sm font-medium text-gray-700">
            As Of Date
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Calculating...' : 'Calculate Transits'}
          </button>
        </form>

        {result && (
          <section className="space-y-6 rounded border border-gray-200 bg-white p-5">
            <div className="flex justify-end">
              <a href={`/api/proxy/astrology/charts/${result.id}/pdf`} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Export PDF
              </a>
            </div>
            <div className="flex justify-center rounded border border-gray-100 bg-gray-950 p-4">
              <ChartWheel chart={result.chartData.natal} transits={{ planets: result.resultData.planets as any, aspects: result.resultData.aspects as any, calculatedAt: new Date() }} size={480} />
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Transit Positions</h3>
              <div className="grid gap-2 md:grid-cols-3">
                {result.resultData.planets.map((planet) => (
                  <div key={planet.name} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-950">{planet.name}</span>
                    <span className="ml-2 text-gray-600">{planet.degree.toFixed(2)} {planet.sign}</span>
                    <span className="ml-2 text-xs text-gray-500">House {planet.house}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Transit-to-Natal Aspects</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.resultData.aspects.slice(0, 30).map((aspect, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-950">Transit {aspect.transitPlanet}</span>
                    <span className="px-2 text-gray-500">{aspect.type}</span>
                    <span className="font-medium text-gray-950">Natal {aspect.natalPlanet}</span>
                    <span className="ml-2 text-xs text-gray-500">({aspect.orb.toFixed(2)} orb)</span>
                  </div>
                ))}
                {result.resultData.aspects.length === 0 && <p className="text-sm text-gray-500">No significant transit aspects found.</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
