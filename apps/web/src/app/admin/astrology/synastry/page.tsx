'use client';

import { FormEvent, useState } from 'react';
import { BirthDataFields, emptyBirthData, toBirthDataPayload, type BirthDataFormState } from '../../../../components/astrology/birth-data-fields';
import { ChartWheel } from '../../../../components/astrology/chart-wheel';

type RelationshipType = 'romantic' | 'friendship' | 'business';

type SynastryResult = {
  id: string;
  chartData: { chart1: any; chart2: any };
  resultData: {
    aspects: Array<{ person1Planet: string; person2Planet: string; type: string; orb: number; interpretation: string }>;
    compatibilityScores: Array<{ category: string; score: number; description: string; icon: string }>;
    overallScore: number;
    soulmate: { connectionType: string; twinFlameScore: number; soulmateScore: number; summary: string; indicators: Array<{ name: string; description: string; strength: number }> };
  };
};

export default function SynastryPage() {
  const [person1, setPerson1] = useState<BirthDataFormState>(emptyBirthData);
  const [person2, setPerson2] = useState<BirthDataFormState>({ ...emptyBirthData, name: '' });
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('romantic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SynastryResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/synastry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          person1: toBirthDataPayload(person1),
          person2: toBirthDataPayload(person2),
          relationshipType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Synastry chart could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synastry chart could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Synastry / Compatibility</h1>
          <p className="mt-2 text-sm text-gray-600">Compare two birth charts for romantic, friendship, or business compatibility.</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <BirthDataFields label="Person 1" value={person1} onChange={setPerson1} />
            <BirthDataFields label="Person 2" value={person2} onChange={setPerson2} />
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Relationship Type
            <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as RelationshipType)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="romantic">Romantic</option>
              <option value="friendship">Friendship</option>
              <option value="business">Business</option>
            </select>
          </label>
          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Generating...' : 'Generate Synastry Report'}
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

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Overall Compatibility</p>
                <p className="mt-1 text-2xl font-bold text-gray-950">{result.resultData.overallScore}%</p>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 md:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Soulmate Analysis</p>
                <p className="mt-1 text-sm font-semibold text-gray-950">{result.resultData.soulmate.connectionType}</p>
                <p className="mt-1 text-sm text-gray-600">{result.resultData.soulmate.summary}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Compatibility Scores</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.resultData.compatibilityScores.map((score) => (
                  <div key={score.category} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-950">{score.icon} {score.category}</span>
                      <span className="font-mono text-gray-700">{score.score}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{score.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Synastry Aspects</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {result.resultData.aspects.slice(0, 20).map((aspect, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-medium text-gray-950">{aspect.person1Planet}</span>
                    <span className="px-2 text-gray-500">{aspect.type}</span>
                    <span className="font-medium text-gray-950">{aspect.person2Planet}</span>
                    <span className="ml-2 text-xs text-gray-500">({aspect.interpretation})</span>
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
