export type BirthDataFormState = {
  name: string;
  date: string;
  time: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  latitude: string;
  longitude: string;
  notes: string;
};

export const emptyBirthData: BirthDataFormState = {
  name: '',
  date: '',
  time: '',
  city: '',
  state: '',
  country: 'United States',
  timezone: '-05:00',
  latitude: '',
  longitude: '',
  notes: '',
};

export function toBirthDataPayload(form: BirthDataFormState): Record<string, string | number> {
  const payload: Record<string, string | number> = {
    name: form.name.trim(),
    date: form.date,
    time: form.time,
    city: form.city.trim(),
    state: form.state.trim(),
    country: form.country.trim(),
    timezone: form.timezone.trim(),
  };
  if (form.notes.trim()) payload.notes = form.notes.trim();
  if (form.latitude.trim() && form.longitude.trim()) {
    payload.latitude = Number(form.latitude);
    payload.longitude = Number(form.longitude);
  }
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
      <label className="block text-sm font-medium text-gray-700">
        Timezone
        <input value={value.timezone} onChange={(e) => set('timezone', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="-05:00" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-700">
          Latitude
          <input type="number" step="any" value={value.latitude} onChange={(e) => set('latitude', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="optional" />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Longitude
          <input type="number" step="any" value={value.longitude} onChange={(e) => set('longitude', e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="optional" />
        </label>
      </div>
    </fieldset>
  );
}
