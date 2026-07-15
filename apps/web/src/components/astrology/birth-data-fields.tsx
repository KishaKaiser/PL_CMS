export type BirthDataFormState = {
  name: string;
  date: string;
  time: string;
  city: string;
  state: string;
  country: string;
  notes: string;
};

export const emptyBirthData: BirthDataFormState = {
  name: '',
  date: '',
  time: '',
  city: '',
  state: '',
  country: 'United States',
  notes: '',
};

// Coordinates and timezone (including historical DST) are always resolved
// automatically server-side from city/state/country and the birth date — the
// form never collects them.
export function toBirthDataPayload(form: BirthDataFormState): Record<string, string> {
  const payload: Record<string, string> = {
    name: form.name.trim(),
    date: form.date,
    time: form.time,
    city: form.city.trim(),
    state: form.state.trim(),
    country: form.country.trim(),
  };
  if (form.notes.trim()) payload.notes = form.notes.trim();
  return payload;
}

export function BirthDataFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BirthDataFormState;
  onChange: (updater: (current: BirthDataFormState) => BirthDataFormState) => void;
}) {
  function set(key: keyof BirthDataFormState, fieldValue: string) {
    onChange((current) => ({ ...current, [key]: fieldValue }));
  }

  return (
    <fieldset className="space-y-4 rounded border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-950">{label}</legend>
      <label className="block text-sm font-medium text-gray-700">
        Name
        <input required value={value.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-700">
          Birth Date
          <input required type="date" value={value.date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('date', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Birth Time
          <input required type="time" value={value.time} onChange={(e) => set('time', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-sm font-medium text-gray-700">
        Birth City
        <input required value={value.city} onChange={(e) => set('city', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-700">
          State
          <input value={value.state} onChange={(e) => set('state', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Country
          <input required value={value.country} onChange={(e) => set('country', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <p className="text-xs text-gray-500">Coordinates and timezone are calculated automatically from the birth location and date.</p>
    </fieldset>
  );
}
