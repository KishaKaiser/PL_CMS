'use client';

import { FormEvent, useState } from 'react';
import { BirthDataFields, emptyBirthData, toBirthDataPayload, type BirthDataFormState } from '../../../../components/astrology/birth-data-fields';
import { ChartWheel } from '../../../../components/astrology/chart-wheel';

type KarmicDebtResult = {
  id: string;
  chartData: any;
  resultData: {
    totalDebtScore: number;
    numerologyDebts: Array<{ debtNumber: string; area: string; description: string; resolution: string; severity: string }>;
    astrologicalDebts: Array<{ indicator: string; placement: string; karmicMeaning: string; lifeChallenge: string; pathToBalance: string; severity: string }>;
    resolutionPaths: Array<{ area: string; challenge: string; actions: string[]; outcome: string; priority: string }>;
  };
  aiText: string | null;
};

export default function KarmicDebtPage() {
  const [birthData, setBirthData] = useState<BirthDataFormState>(emptyBirthData);
  const [birthName, setBirthName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<KarmicDebtResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/astrology/charts/karmic-debt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ birthData: toBirthDataPayload(birthData), birthName: birthName.trim() || birthData.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Karmic debt report could not be generated.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Karmic debt report could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-950">Karmic Debt</h1>
          <p className="mt-2 text-sm text-gray-600">Combines numerology (birth name) and astrological indicators (South Node, Saturn, Pluto, Chiron) with an AI-written reflection.</p>
        </header>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-5">
          <BirthDataFields label="Birth Data" value={birthData} onChange={setBirthData} />
          <label className="block text-sm font-medium text-gray-700">
            Full Birth Name (for numerology; defaults to Name above)
            <input value={birthName} onChange={(e) => setBirthName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
            {loading ? 'Generating...' : 'Generate Karmic Debt Report'}
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
              <ChartWheel chart={result.chartData} size={400} />
            </div>

            <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Total Karmic Debt Score</p>
              <p className="mt-1 text-2xl font-bold text-gray-950">{result.resultData.totalDebtScore}/100</p>
            </div>

            {result.aiText && (
              <div className="rounded border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-gray-800 whitespace-pre-line">{result.aiText}</div>
            )}

            {result.resultData.numerologyDebts.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Numerology Debts</h3>
                <div className="space-y-2">
                  {result.resultData.numerologyDebts.map((debt, index) => (
                    <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                      <p className="font-semibold text-gray-950">{debt.debtNumber} — {debt.area} ({debt.severity})</p>
                      <p className="mt-1 text-gray-600">{debt.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Astrological Debts</h3>
              <div className="space-y-2">
                {result.resultData.astrologicalDebts.map((debt, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <p className="font-semibold text-gray-950">{debt.indicator} — {debt.placement} ({debt.severity})</p>
                    <p className="mt-1 text-gray-600">{debt.lifeChallenge}</p>
                    <p className="mt-1 text-gray-600">Path to balance: {debt.pathToBalance}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Resolution Paths</h3>
              <div className="space-y-2">
                {result.resultData.resolutionPaths.map((path, index) => (
                  <div key={index} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <p className="font-semibold text-gray-950">{path.area} ({path.priority})</p>
                    <ul className="mt-1 list-disc pl-5 text-gray-600">
                      {path.actions.map((action, actionIndex) => (
                        <li key={actionIndex}>{action}</li>
                      ))}
                    </ul>
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
