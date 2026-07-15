'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ChartData } from '@pl-cms/shared';
import { ChartWheel } from '../../../components/astrology/chart-wheel';

type ChartSummary = {
  id: string;
  reportType: string;
  title: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChartRecord = {
  id: string;
  reportType: string;
  title: string;
  chartData: ChartData;
  aiText: string | null;
};

type ChartFormData = {
  name: string;
  date: string;
  time: string;
  city: string;
  state: string;
  country: string;
  notes: string;
};

const emptyForm: ChartFormData = {
  name: '',
  date: '',
  time: '',
  city: '',
  state: '',
  country: 'United States',
  notes: '',
};

const EVENT_TYPES = ['marriage', 'child', 'career', 'relocation', 'accident', 'loss', 'education', 'financial', 'health', 'spiritual'];

type LifeEventForm = { type: string; date: string; description: string };
type TimeSuggestion = { time: string; score: number; reasoning: string };

const planetOrder = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'North Node', 'South Node', 'Part of Fortune'];

export default function AdminAstrologyPage() {
  const [charts, setCharts] = useState<ChartSummary[]>([]);
  const [selectedChart, setSelectedChart] = useState<ChartData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ChartFormData>(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [lifeEvents, setLifeEvents] = useState<LifeEventForm[]>([{ type: 'career', date: '', description: '' }]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<TimeSuggestion[] | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [interpretationLoading, setInterpretationLoading] = useState(false);

  function updateLifeEvent(index: number, patch: Partial<LifeEventForm>) {
    setLifeEvents((current) => current.map((event, i) => (i === index ? { ...event, ...patch } : event)));
  }

  function addLifeEvent() {
    setLifeEvents((current) => [...current, { type: 'career', date: '', description: '' }]);
  }

  function removeLifeEvent(index: number) {
    setLifeEvents((current) => current.filter((_, i) => i !== index));
  }

  async function handleSuggestTimes() {
    setSuggesting(true);
    setError('');
    setSuggestions(null);
    try {
      const res = await fetch('/api/proxy/astrology/charts/rectification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          birthDate: form.date,
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          events: lifeEvents.filter((event) => event.date),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Birth time could not be estimated.');
      setSuggestions(data.resultData as TimeSuggestion[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Birth time could not be estimated.');
    } finally {
      setSuggesting(false);
    }
  }

  function applySuggestedTime(time: string) {
    setForm((current) => ({ ...current, time }));
    setTimeUnknown(false);
    setSuggestions(null);
  }

  async function refreshList() {
    setListLoading(true);
    try {
      const res = await fetch('/api/proxy/astrology/charts');
      if (!res.ok) throw new Error('Chart library could not be loaded.');
      const data = (await res.json()) as ChartSummary[];
      setCharts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart library could not be loaded.');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    refreshList();
  }, []);

  const filteredCharts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return charts;
    return charts.filter((chart) => chart.title.toLowerCase().includes(needle) || chart.reportType.toLowerCase().includes(needle));
  }, [charts, search]);

  async function loadChart(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/proxy/astrology/charts/${id}`);
      if (!res.ok) throw new Error('Chart could not be loaded.');
      const data = (await res.json()) as ChartRecord;
      setSelectedChart(data.chartData);
      setSelectedId(data.id);
      setAiText(data.aiText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart could not be loaded.');
    }
  }

  async function handleGenerateInterpretation() {
    if (!selectedId) return;
    setInterpretationLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/astrology/charts/${selectedId}/interpretation`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'The AI interpretation could not be generated.');
      setAiText((data as ChartRecord).aiText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI interpretation could not be generated.');
    } finally {
      setInterpretationLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const payload: Record<string, string> = {
        name: form.name.trim(),
        date: form.date,
        time: form.time,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        notes: form.notes.trim(),
      };

      const res = await fetch('/api/proxy/astrology/charts/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Chart could not be generated.');

      const chart = data as ChartData;
      setSelectedChart(chart);
      setSelectedId(chart.id);
      setAiText(null);
      setForm(emptyForm);
      setTimeUnknown(false);
      setLifeEvents([{ type: 'career', date: '', description: '' }]);
      setSuggestions(null);
      setMessage('Chart saved to the astrology library.');
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteChart(id: string, title: string) {
    if (!window.confirm(`Delete chart "${title}"?`)) return;
    try {
      const res = await fetch(`/api/proxy/astrology/charts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Chart could not be deleted.');
      if (selectedId === id) {
        setSelectedChart(null);
        setSelectedId(null);
        setAiText(null);
      }
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart could not be deleted.');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-gray-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">Astrology Module</p>
            <h1 className="mt-1 text-3xl font-bold text-gray-950">Chart Library</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Create natal charts inside PL_CMS, save client chart data, and inspect placements before selling or generating full reports.
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <span className="font-semibold text-gray-950">{charts.length}</span> saved charts
          </div>
        </header>

        {(message || error) && (
          <div className={`rounded border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {error || message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <section className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-950">Generate Natal Chart</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <label className="block text-sm font-medium text-gray-700">
                Name
                <input required value={form.name} onChange={(event) => setFormValue('name', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Client name" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Birth Date
                  <input required type="date" value={form.date} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setFormValue('date', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Birth Time
                  <input
                    required={!timeUnknown}
                    disabled={timeUnknown}
                    type="time"
                    value={form.time}
                    onChange={(event) => setFormValue('time', event.target.value, setForm)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={timeUnknown}
                  onChange={(event) => {
                    setTimeUnknown(event.target.checked);
                    if (event.target.checked) setFormValue('time', '', setForm);
                  }}
                />
                I don&apos;t know the exact birth time
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Birth City
                <input required value={form.city} onChange={(event) => setFormValue('city', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="New York" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  State
                  <input value={form.state} onChange={(event) => setFormValue('state', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="NY" />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Country
                  <input required value={form.country} onChange={(event) => setFormValue('country', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <p className="text-xs text-gray-500">Coordinates and timezone (including historical DST) are calculated automatically from the birth city, state, and date.</p>

              {timeUnknown && (
                <div className="space-y-3 rounded border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-950">Add life events to estimate the time</h3>
                    <button type="button" onClick={addLifeEvent} className="text-sm font-medium text-indigo-600 hover:underline">+ Add event</button>
                  </div>
                  {lifeEvents.map((lifeEvent, index) => (
                    <div key={index} className="grid grid-cols-[130px_140px_1fr_auto] gap-2">
                      <select value={lifeEvent.type} onChange={(event) => updateLifeEvent(index, { type: event.target.value })} className="rounded border border-gray-300 px-2 py-2 text-xs">
                        {EVENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <input type="date" value={lifeEvent.date} onChange={(event) => updateLifeEvent(index, { date: event.target.value })} className="rounded border border-gray-300 px-2 py-2 text-xs" />
                      <input value={lifeEvent.description} onChange={(event) => updateLifeEvent(index, { description: event.target.value })} placeholder="Description (optional)" className="rounded border border-gray-300 px-2 py-2 text-xs" />
                      <button type="button" onClick={() => removeLifeEvent(index)} className="rounded px-2 text-xs text-red-700 hover:bg-red-100">Remove</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={suggesting || !form.date || !form.city.trim() || !form.country.trim()}
                    onClick={handleSuggestTimes}
                    className="w-full rounded border border-indigo-300 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {suggesting ? 'Estimating...' : 'Suggest Birth Times'}
                  </button>
                  {suggestions && (
                    <div className="space-y-2">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => applySuggestedTime(suggestion.time)}
                          className="block w-full rounded border border-gray-200 bg-white p-2 text-left text-xs hover:border-indigo-400"
                        >
                          <span className="font-semibold text-gray-950">{suggestion.time}</span>
                          <span className="ml-2 text-gray-500">confidence {suggestion.score}%</span>
                          <p className="mt-1 text-gray-600">{suggestion.reasoning}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700">
                Notes
                <textarea value={form.notes} rows={4} onChange={(event) => setFormValue('notes', event.target.value, setForm)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <button disabled={loading || timeUnknown} className="w-full rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-400">
                {loading ? 'Generating...' : timeUnknown ? 'Select a birth time to continue' : 'Generate Chart'}
              </button>
            </form>
          </section>

          <div className="space-y-6">
            <section className="rounded border border-gray-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-gray-950">Saved Charts</h2>
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm md:w-72" placeholder="Search by name or report type" />
              </div>
              {listLoading ? (
                <p className="p-8 text-center text-sm text-gray-500">Loading...</p>
              ) : filteredCharts.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">{charts.length === 0 ? 'No charts saved yet.' : 'No charts match this search.'}</p>
              ) : (
                <div className="grid gap-3 p-5 lg:grid-cols-2">
                  {filteredCharts.map((chart) => (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => loadChart(chart.id)}
                      className={`rounded border p-4 text-left transition ${selectedId === chart.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-gray-950">{chart.title}</h3>
                          <p className="mt-1 text-sm text-gray-500">{chart.reportType}</p>
                        </div>
                        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{chart.status}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                        <span>{new Date(chart.createdAt).toLocaleDateString()}</span>
                        <span
                          role="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteChart(chart.id, chart.title);
                          }}
                          className="rounded px-2 py-1 font-medium text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {selectedChart && (
              <section className="rounded border border-gray-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-950">{selectedChart.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">{selectedChart.location}</p>
                  </div>
                  {selectedId && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateInterpretation}
                        disabled={interpretationLoading}
                        className="rounded border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:text-gray-400"
                      >
                        {interpretationLoading ? 'Generating...' : aiText ? 'Regenerate AI Interpretation' : 'Generate AI Interpretation'}
                      </button>
                      <a
                        href={`/api/proxy/astrology/charts/${selectedId}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Export PDF
                      </a>
                    </div>
                  )}
                </div>
                <ChartDetail chart={selectedChart} aiText={aiText} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartDetail({ chart, aiText }: { chart: ChartData; aiText: string | null }) {
  const orderedPlanets = [...chart.planets].sort((a, b) => planetOrder.indexOf(a.name) - planetOrder.indexOf(b.name));

  return (
    <div className="space-y-6 p-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Date" value={chart.date} />
        <Metric label="Time" value={`${chart.time} UTC${chart.timezone}`} />
        <Metric label="Ascendant" value={formatPlacement(chart.ascendant)} />
        <Metric label="Midheaven" value={formatPlacement(chart.midheaven)} />
      </div>

      <div className="flex justify-center rounded border border-gray-100 bg-gray-950 p-4">
        <ChartWheel chart={chart} size={480} />
      </div>

      {aiText && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">AI Interpretation</h3>
          <div className="max-h-96 overflow-y-auto whitespace-pre-line rounded border border-indigo-200 bg-indigo-50 p-4 text-sm text-gray-800">
            {aiText}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Planet Placements</h3>
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Planet</th>
                    <th className="px-3 py-2">Sign</th>
                    <th className="px-3 py-2">Degree</th>
                    <th className="px-3 py-2">House</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderedPlanets.map((planet) => (
                    <tr key={planet.name}>
                      <td className="px-3 py-2 font-medium text-gray-950">{planet.name}</td>
                      <td className="px-3 py-2 text-gray-700">{planet.sign}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{planet.degree.toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-700">{planet.house}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Major Aspects</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {chart.aspects.slice(0, 16).map((aspect) => (
                <div key={`${aspect.planet1}-${aspect.planet2}-${aspect.type}`} className="rounded border border-gray-200 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-950">{aspect.planet1}</span>
                  <span className="px-2 text-gray-500">{aspect.type}</span>
                  <span className="font-medium text-gray-950">{aspect.planet2}</span>
                  <span className="ml-2 text-xs text-gray-500">{aspect.orb.toFixed(2)} orb</span>
                </div>
              ))}
              {chart.aspects.length === 0 && <p className="text-sm text-gray-500">No major aspects found.</p>}
            </div>
          </div>

          {chart.aspectPatterns.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Aspect Patterns</h3>
              <div className="space-y-2">
                {chart.aspectPatterns.map((pattern, index) => (
                  <div key={`${pattern.type}-${index}`} className="rounded border border-gray-200 px-3 py-2 text-sm">
                    <span className="font-semibold text-gray-950">{pattern.type}</span>
                    <span className="ml-2 text-gray-600">{pattern.planets.join(', ')}</span>
                    <p className="mt-1 text-xs text-gray-500">{pattern.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Chart Data</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <InfoRow label="Coordinates" value={`${chart.latitude.toFixed(4)}, ${chart.longitude.toFixed(4)}`} />
              <InfoRow label="Source" value={chart.coordinateSource} />
              <InfoRow label="House System" value={chart.houseSystem} />
              <InfoRow label="Saved" value={new Date(chart.createdAt).toLocaleString()} />
            </dl>
          </div>
          <div className="rounded border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">Houses</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {chart.houses.map((house) => (
                <div key={house.number} className="rounded bg-gray-50 px-3 py-2">
                  <span className="font-medium text-gray-950">House {house.number}</span>
                  <span className="block text-xs text-gray-500">{formatPlacement(house.cusp)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-950">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function setFormValue(
  key: keyof ChartFormData,
  value: string,
  setForm: (updater: (current: ChartFormData) => ChartFormData) => void,
) {
  setForm((current) => ({ ...current, [key]: value }));
}

function formatPlacement(longitude: number) {
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const normalized = ((longitude % 360) + 360) % 360;
  const sign = signs[Math.floor(normalized / 30)] ?? 'Aries';
  return `${(normalized % 30).toFixed(2)} ${sign}`;
}
