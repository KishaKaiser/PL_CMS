'use client';

import { FormEvent, useState } from 'react';
import { BirthDataFields, emptyBirthData, toBirthDataPayload, type BirthDataFormState } from '../../../../components/astrology/birth-data-fields';
import { ChartWheel } from '../../../../components/astrology/chart-wheel';

type KarmicResult = {
  id: string;
  chartData: { chart1: any; chart2: any };
  resultData: {
    karmicAspects: Array<{ person1Planet: string; person2Planet: string; type: string; significance: string; interpretation: string }>;
    karmicIndicators: Array<{ type: string; description: string; strength: number; icon: string }>;
    connections: Array<{ theme: string; pastLifeRole: string; lessonToLearn: string; giftToShare: string; strength: number }>;
    overallKarmicScore: number;
    relationshipType: string;
  };
};

export default function KarmicPage() {
  const [person1, setPerson1] = useState<BirthDataFormState>(emptyBirthData);
  const [person2, setPerson2] = useState<BirthDataFormState>(emptyBirthData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<KarmicResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/karmic', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ person1: toBirthDataPayload(person1), person2: toBirthDataPayload(person2) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Karmic relationship report could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karmic relationship report could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Karmic Relationship</h1>
          <p className="mt-2 text-sm text-gray-600">Analyze past-life ties, karmic lessons, and destiny connections between two charts.</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <BirthDataFields label="Person 1" value={person1} onChange={setPerson1} />
            <BirthDataFields label="Person 2" value={person2} onChange={setPerson2} />
          </div>
          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Generating...' : 'Generate Karmic Report'}
          </button>
        </form>

        {result && (
          <section className="space-y-6 rounded border border-gray-200 bg-white p-5">
            <div className="flex justify-end">
              <a href={`/api/proxy/astrology/charts/${result.id}/pdf`} target="_blank" rel="noreferrer" className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Export PDF
              </a>
            </div>
            <div className="flex justify-center gap-6 rounded border border-gray-100 bg-gray-950 p-4">
              <ChartWheel chart={result.chartData.chart1} size={340} />
              <ChartWheel chart={result.chartData.chart2} size={340} />
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Karmic Score</p>
              <p className="mt-1 text-2xl font-bold text-gray-950">{result.resultData.overallKarmicScore}% — {result.resultData.relationshipType}</p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Karmic Connections</h3>
              <div className="space-y-2">
                {result.resultData.connections.map((connection, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <p className="font-semibold text-gray-950">{connection.theme} ({connection.strength}%)</p>
                    <p className="mt-1 text-gray-600">Past life: {connection.pastLifeRole}</p>
                    <p className="mt-1 text-gray-600">Lesson: {connection.lessonToLearn}</p>
                    <p className="mt-1 text-gray-600">Gift: {connection.giftToShare}</p>
                  </div>
                ))}
                {result.resultData.connections.length === 0 && <p className="text-sm text-gray-500">No strong karmic connections detected.</p>}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Karmic Indicators</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.resultData.karmicIndicators.map((indicator, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-950">{indicator.icon} {indicator.description}</span>
                    <span className="ml-2 font-mono text-xs text-gray-500">{indicator.strength}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Karmic Aspects</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.resultData.karmicAspects.slice(0, 20).map((aspect, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-950">{aspect.person1Planet}</span>
                    <span className="px-2 text-gray-500">{aspect.type}</span>
                    <span className="font-medium text-gray-950">{aspect.person2Planet}</span>
                    <span className="ml-2 text-xs text-gray-500">({aspect.significance})</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
