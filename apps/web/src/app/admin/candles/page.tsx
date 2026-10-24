'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CandlePreview } from '../../../components/candles/candle-preview';

interface AdminSize {
  id: string;
  label: string;
  extraPrice: number;
  heightPercent: number;
}

interface AdminType {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  photoMediaId: string | null;
  photoUrl: string | null;
  waxMaskMediaId: string | null;
  waxMaskUrl: string | null;
  allowTwoColors: boolean;
  twoColorExtra: number;
  allowHerbs: boolean;
  waxTopPercent: number;
  weightOz: number | null;
  isActive: boolean;
  sortOrder: number;
  sizes: AdminSize[];
}

interface AdminColor {
  id: string;
  name: string;
  hex: string;
  isActive: boolean;
  sortOrder: number;
}

interface AdminHerb {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

interface MediaImage {
  id: string;
  title: string;
  originalName: string;
  url: string;
  isImage: boolean;
}

interface SizeForm {
  id?: string;
  label: string;
  extraPrice: string;
  heightPercent: string;
}

const emptyTypeForm = {
  id: undefined as string | undefined,
  name: '',
  description: '',
  basePrice: '',
  photoMediaId: '',
  waxMaskMediaId: '',
  allowTwoColors: false,
  twoColorExtra: '0',
  allowHerbs: false,
  waxTopPercent: '0',
  weightOz: '',
  isActive: true,
  sortOrder: '0',
  sizes: [] as SizeForm[],
};
type TypeForm = typeof emptyTypeForm;

/** Starting points for a new candle type; every number can be changed afterwards. */
const PRESETS: Array<{ label: string; apply: Partial<TypeForm> }> = [
  { label: 'Standard candle (one color)', apply: {} },
  { label: 'Glass-enclosed candle (two colors, herbs)', apply: { allowTwoColors: true, twoColorExtra: '3', allowHerbs: true } },
  {
    label: 'Pillar candle (3 heights, two colors, herbs)',
    apply: {
      allowTwoColors: true,
      twoColorExtra: '3',
      allowHerbs: true,
      sizes: [
        { label: '4 inch', extraPrice: '0', heightPercent: '55' },
        { label: '6 inch', extraPrice: '3', heightPercent: '75' },
        { label: '9 inch', extraPrice: '6', heightPercent: '100' },
      ],
    },
  },
];

const STARTER_COLORS = [
  ['White', '#ffffff'],
  ['Black', '#1a1a1a'],
  ['Red', '#d62828'],
  ['Pink', '#f78fb3'],
  ['Orange', '#f77f00'],
  ['Yellow', '#fcd34d'],
  ['Green', '#2f9e44'],
  ['Blue', '#2563eb'],
  ['Purple', '#7c3aed'],
  ['Brown', '#7b4a2b'],
  ['Gold', '#d4a017'],
  ['Silver', '#b8bec6'],
] as const;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/proxy/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
    throw new Error(message || 'Something went wrong.');
  }
  return data as T;
}

const inputClass = 'mt-1 w-full rounded border px-3 py-2 text-sm';

export default function AdminCandlesPage() {
  const [types, setTypes] = useState<AdminType[]>([]);
  const [colors, setColors] = useState<AdminColor[]>([]);
  const [herbs, setHerbs] = useState<AdminHerb[]>([]);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<TypeForm | null>(null);

  const load = useCallback(async () => {
    try {
      const [overview, media] = await Promise.all([
        request<{ types: AdminType[]; colors: AdminColor[]; herbs: AdminHerb[] }>('GET', 'admin/candles'),
        request<MediaImage[]>('GET', 'media'),
      ]);
      setTypes(overview.types);
      setColors(overview.colors);
      setHerbs(overview.herbs);
      setImages(media.filter((asset) => asset.isImage));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the candle settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, done: string) {
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      setMessage(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function startNewType(presetIndex: number) {
    setForm({ ...emptyTypeForm, ...PRESETS[presetIndex].apply });
    setError('');
    setMessage('');
  }

  function editType(type: AdminType) {
    setForm({
      id: type.id,
      name: type.name,
      description: type.description ?? '',
      basePrice: String(type.basePrice),
      photoMediaId: type.photoMediaId ?? '',
      waxMaskMediaId: type.waxMaskMediaId ?? '',
      allowTwoColors: type.allowTwoColors,
      twoColorExtra: String(type.twoColorExtra),
      allowHerbs: type.allowHerbs,
      waxTopPercent: String(type.waxTopPercent ?? 0),
      weightOz: type.weightOz == null ? '' : String(type.weightOz),
      isActive: type.isActive,
      sortOrder: String(type.sortOrder),
      sizes: type.sizes.map((size) => ({ id: size.id, label: size.label, extraPrice: String(size.extraPrice), heightPercent: String(size.heightPercent) })),
    });
    setError('');
    setMessage('');
  }

  async function saveType(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      basePrice: Number(form.basePrice),
      photoMediaId: form.photoMediaId || null,
      waxMaskMediaId: form.waxMaskMediaId || null,
      allowTwoColors: form.allowTwoColors,
      twoColorExtra: form.allowTwoColors ? Number(form.twoColorExtra || 0) : 0,
      allowHerbs: form.allowHerbs,
      waxTopPercent: Math.min(50, Math.max(0, Math.round(Number(form.waxTopPercent || 0)))),
      weightOz: form.weightOz === '' ? null : Number(form.weightOz),
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder || 0),
      sizes: form.sizes.map((size) => ({
        ...(size.id ? { id: size.id } : {}),
        label: size.label.trim(),
        extraPrice: Number(size.extraPrice || 0),
        heightPercent: Number(size.heightPercent || 100),
      })),
    };
    await run(async () => {
      if (form.id) await request('PUT', `admin/candles/types/${form.id}`, payload);
      else await request('POST', 'admin/candles/types', payload);
      setForm(null);
    }, form.id ? 'Candle saved.' : 'Candle added.');
  }

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold">Custom candles</h1>
        <p className="mt-1 text-sm text-gray-600">
          Customers design a candle at <span className="font-mono">/custom-candles</span> (add it to a menu under Menus, or place the Custom Candle Builder block on any page).
          They choose a candle, a color, and where it applies a second color, a height and herbs, and the picture changes as they choose.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      {/* ── Candle types ─────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Candles</h2>
          <label className="text-sm">
            <span className="sr-only">Add a candle</span>
            <select
              value=""
              onChange={(event) => event.target.value !== '' && startNewType(Number(event.target.value))}
              className="rounded border bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
            >
              <option value="">+ Add a candle…</option>
              {PRESETS.map((preset, index) => (
                <option key={preset.label} value={index} className="text-gray-900">
                  Start from: {preset.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {types.length === 0 && !form && <p className="mt-4 text-sm text-gray-500">No candles yet. Add one to get started.</p>}

        <ul className="mt-4 divide-y">
          {types.map((type) => (
            <li key={type.id} className="flex flex-wrap items-center gap-4 py-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded border bg-gray-50">
                {type.photoUrl ? <img src={type.photoUrl} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-xs text-gray-400">No photo</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {type.name} <span className="font-normal text-gray-500">from ${type.basePrice.toFixed(2)}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                  {!type.isActive && <span className="font-medium text-red-600">Switched off</span>}
                  {type.allowTwoColors && <span>Two colors{type.twoColorExtra > 0 ? ` (+$${type.twoColorExtra.toFixed(2)})` : ''}</span>}
                  {type.sizes.length > 0 && <span>{type.sizes.length} heights</span>}
                  {type.allowHerbs && <span>Herbs</span>}
                  {!type.photoUrl && <span className="text-amber-700">Needs a photo</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => editType(type)} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(`Delete "${type.name}"? Orders that already include it keep what was chosen.`) && void run(() => request('DELETE', `admin/candles/types/${type.id}`), 'Candle deleted.')}
                  className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {form && (
          <TypeEditor
            form={form}
            setForm={setForm}
            images={images}
            colors={colors}
            onSubmit={saveType}
            onCancel={() => setForm(null)}
          />
        )}
      </section>

      {/* ── Colors ───────────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Colors</h2>
            <p className="text-sm text-gray-600">The colors customers can choose. Every candle uses this one list.</p>
          </div>
          {colors.length === 0 && (
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  for (const [index, [name, hex]] of STARTER_COLORS.entries()) await request('POST', 'admin/candles/colors', { name, hex, sortOrder: index });
                }, 'Starter colors added.')
              }
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Add 12 starter colors
            </button>
          )}
        </div>
        <div className="mt-4 space-y-2">
          {colors.map((color) => (
            <ColorRow key={color.id} color={color} onSave={(values) => run(() => request('PUT', `admin/candles/colors/${color.id}`, values), 'Color saved.')} onDelete={() => run(() => request('DELETE', `admin/candles/colors/${color.id}`), 'Color deleted.')} />
          ))}
          <ColorRow
            key={`new-${colors.length}`}
            color={{ id: '', name: '', hex: '#2f9e44', isActive: true, sortOrder: colors.length }}
            onSave={(values) => run(() => request('POST', 'admin/candles/colors', values), 'Color added.')}
          />
        </div>
      </section>

      {/* ── Herbs ────────────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Herbs</h2>
        <p className="text-sm text-gray-600">
          The herbs customers can add to candles that allow them. The price is added to the candle. Herbs are not drawn on the candle in the picture; the order records which were chosen.
        </p>
        <div className="mt-4 space-y-2">
          {herbs.map((herb) => (
            <HerbRow key={herb.id} herb={herb} onSave={(values) => run(() => request('PUT', `admin/candles/herbs/${herb.id}`, values), 'Herb saved.')} onDelete={() => run(() => request('DELETE', `admin/candles/herbs/${herb.id}`), 'Herb deleted.')} />
          ))}
          <HerbRow
            key={`new-${herbs.length}`}
            herb={{ id: '', name: '', price: 0, isActive: true, sortOrder: herbs.length }}
            onSave={(values) => run(() => request('POST', 'admin/candles/herbs', values), 'Herb added.')}
          />
        </div>
      </section>
    </div>
  );
}

function TypeEditor({
  form,
  setForm,
  images,
  colors,
  onSubmit,
  onCancel,
}: {
  form: TypeForm;
  setForm: (form: TypeForm) => void;
  images: MediaImage[];
  colors: AdminColor[];
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const update = (patch: Partial<TypeForm>) => setForm({ ...form, ...patch });
  const photo = images.find((image) => image.id === form.photoMediaId) ?? null;
  const waxMask = images.find((image) => image.id === form.waxMaskMediaId) ?? null;

  // A small test bench so the photo can be checked with real colors before customers see it.
  const [testColor1, setTestColor1] = useState('');
  const [testColor2, setTestColor2] = useState('');
  const [testSize, setTestSize] = useState('');
  const activeColors = useMemo(() => colors.filter((color) => color.isActive), [colors]);
  const sizeToShow = form.sizes.find((size, index) => (size.id ?? `new-${index}`) === testSize);

  function updateSize(index: number, patch: Partial<SizeForm>) {
    update({ sizes: form.sizes.map((size, i) => (i === index ? { ...size, ...patch } : size)) });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-6 rounded-lg border border-indigo-200 bg-indigo-50/30 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
      <div className="space-y-4">
        <h3 className="text-base font-semibold">{form.id ? 'Edit candle' : 'New candle'}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Name
            <input required value={form.name} onChange={(event) => update({ name: event.target.value })} className={inputClass} placeholder="Cat candle" />
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Short description (optional)
            <input value={form.description} onChange={(event) => update({ description: event.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Price ($)
            <input required type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => update({ basePrice: event.target.value })} className={inputClass} />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Shipping weight (oz)
            <input type="number" min="0" step="0.1" value={form.weightOz} onChange={(event) => update({ weightOz: event.target.value })} className={inputClass} placeholder="Used for postage" />
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Photo of the white candle
            <select value={form.photoMediaId} onChange={(event) => update({ photoMediaId: event.target.value })} className={inputClass}>
              <option value="">Choose from the media library</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.title || image.originalName}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-gray-500">
              Use a photo of the unlit candle, ideally a PNG or WEBP cut-out with a see-through background, so only the candle is colored. Upload it in the Media Library first, then reload this page.
            </span>
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Wax area picture (optional, for glass-enclosed candles)
            <select value={form.waxMaskMediaId} onChange={(event) => update({ waxMaskMediaId: event.target.value })} className={inputClass}>
              <option value="">None: color the whole candle</option>
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.title || image.originalName}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-gray-500">
              The same picture, the same size, with the wax painted white and everything else (such as the glass) black. Only the white part is colored.
            </span>
          </label>
          <label className="block text-sm font-medium text-gray-700 sm:col-span-2">
            Top of the wax (% down from the top of the candle)
            <input type="number" min="0" max="50" value={form.waxTopPercent} onChange={(event) => update({ waxTopPercent: event.target.value })} className={inputClass} />
            <span className="mt-1 block text-xs font-normal text-gray-500">
              For glass candles that are not filled to the rim: the color starts this far down, and two colors are split between there and the bottom. Try 3 or 4 and watch the picture on the right. Leave 0 for candles without a gap.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowTwoColors} onChange={(event) => update({ allowTwoColors: event.target.checked })} />
            Allow two colors (top and bottom)
          </label>
          {form.allowTwoColors && (
            <label className="flex items-center gap-2 text-sm">
              Extra charge for two colors ($)
              <input type="number" min="0" step="0.01" value={form.twoColorExtra} onChange={(event) => update({ twoColorExtra: event.target.value })} className="w-24 rounded border px-2 py-1 text-sm" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowHerbs} onChange={(event) => update({ allowHerbs: event.target.checked })} />
            Allow herbs on top
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => update({ isActive: event.target.checked })} />
            Show to customers
          </label>
          <label className="flex items-center gap-2 text-sm">
            Order in the list
            <input type="number" value={form.sortOrder} onChange={(event) => update({ sortOrder: event.target.value })} className="w-20 rounded border px-2 py-1 text-sm" />
          </label>
        </div>

        <fieldset className="rounded border bg-white p-4">
          <legend className="px-1 text-sm font-semibold">Heights (leave empty if this candle has only one height)</legend>
          <div className="space-y-2">
            {form.sizes.map((size, index) => (
              <div key={size.id ?? `new-${index}`} className="grid grid-cols-[minmax(0,1fr)_90px_90px_auto] items-end gap-2">
                <label className="text-xs text-gray-600">
                  Name
                  <input required value={size.label} onChange={(event) => updateSize(index, { label: event.target.value })} className={inputClass} placeholder="6 inch" />
                </label>
                <label className="text-xs text-gray-600">
                  Extra ($)
                  <input type="number" min="0" step="0.01" value={size.extraPrice} onChange={(event) => updateSize(index, { extraPrice: event.target.value })} className={inputClass} />
                </label>
                <label className="text-xs text-gray-600" title="How tall the candle is drawn compared with the tallest height">
                  Picture %
                  <input type="number" min="20" max="100" value={size.heightPercent} onChange={(event) => updateSize(index, { heightPercent: event.target.value })} className={inputClass} />
                </label>
                <button type="button" onClick={() => update({ sizes: form.sizes.filter((_, i) => i !== index) })} className="rounded border border-red-200 px-2 py-2 text-xs text-red-600 hover:bg-red-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => update({ sizes: [...form.sizes, { label: '', extraPrice: '0', heightPercent: '100' }] })} className="mt-3 rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
            + Add a height
          </button>
          <p className="mt-2 text-xs text-gray-500">Picture % is how tall the candle looks in the picture. Give the tallest height 100 and the others a smaller number.</p>
        </fieldset>

        <div className="flex gap-3">
          <button type="submit" className="rounded bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Save candle
          </button>
          <button type="button" onClick={onCancel} className="rounded border px-5 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Try it</p>
        <CandlePreview
          photoUrl={photo?.url ?? null}
          waxMaskUrl={waxMask?.url ?? null}
          color1={activeColors.find((color) => color.id === testColor1)?.hex}
          color2={form.allowTwoColors ? activeColors.find((color) => color.id === testColor2)?.hex : null}
          heightPercent={sizeToShow ? Number(sizeToShow.heightPercent) || 100 : undefined}
          waxTopPercent={Number(form.waxTopPercent) || 0}
          label="Preview of the candle"
          emptyText="Choose a photo to see it here"
        />
        <label className="block text-xs font-medium text-gray-600">
          Color
          <select value={testColor1} onChange={(event) => setTestColor1(event.target.value)} className={inputClass}>
            <option value="">None (the photo as it is)</option>
            {activeColors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.name}
              </option>
            ))}
          </select>
        </label>
        {form.allowTwoColors && (
          <label className="block text-xs font-medium text-gray-600">
            Second color
            <select value={testColor2} onChange={(event) => setTestColor2(event.target.value)} className={inputClass}>
              <option value="">None</option>
              {activeColors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.sizes.length > 0 && (
          <label className="block text-xs font-medium text-gray-600">
            Height
            <select value={testSize} onChange={(event) => setTestSize(event.target.value)} className={inputClass}>
              <option value="">Full height</option>
              {form.sizes.map((size, index) => (
                <option key={size.id ?? `new-${index}`} value={size.id ?? `new-${index}`}>
                  {size.label || `Height ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </form>
  );
}

function ColorRow({
  color,
  onSave,
  onDelete,
}: {
  color: AdminColor;
  onSave: (values: { name: string; hex: string; isActive: boolean; sortOrder: number }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const [name, setName] = useState(color.name);
  const [hex, setHex] = useState(color.hex);
  const [isActive, setIsActive] = useState(color.isActive);
  const [sortOrder, setSortOrder] = useState(String(color.sortOrder));
  const isNew = !color.id;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border p-2">
      <input type="color" value={hex} onChange={(event) => setHex(event.target.value)} aria-label="Color" className="h-9 w-12 cursor-pointer rounded border" />
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder={isNew ? 'New color name' : 'Name'} aria-label="Color name" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" />
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Show
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        Order
        <input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="w-16 rounded border px-2 py-1 text-sm" />
      </label>
      <button type="button" disabled={!name.trim()} onClick={() => void onSave({ name: name.trim(), hex, isActive, sortOrder: Number(sortOrder || 0) })} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
        {isNew ? 'Add' : 'Save'}
      </button>
      {onDelete && (
        <button type="button" onClick={() => window.confirm(`Delete the color "${color.name}"?`) && void onDelete()} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Delete
        </button>
      )}
    </div>
  );
}

function HerbRow({
  herb,
  onSave,
  onDelete,
}: {
  herb: AdminHerb;
  onSave: (values: { name: string; price: number; isActive: boolean; sortOrder: number }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const [name, setName] = useState(herb.name);
  const [price, setPrice] = useState(String(herb.price));
  const [isActive, setIsActive] = useState(herb.isActive);
  const [sortOrder, setSortOrder] = useState(String(herb.sortOrder));
  const isNew = !herb.id;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border p-2">
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder={isNew ? 'New herb name' : 'Name'} aria-label="Herb name" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm" />
      <label className="flex items-center gap-1 text-xs text-gray-600">
        Price $
        <input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="w-20 rounded border px-2 py-1 text-sm" />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Show
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        Order
        <input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="w-16 rounded border px-2 py-1 text-sm" />
      </label>
      <button type="button" disabled={!name.trim()} onClick={() => void onSave({ name: name.trim(), price: Number(price || 0), isActive, sortOrder: Number(sortOrder || 0) })} className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
        {isNew ? 'Add' : 'Save'}
      </button>
      {onDelete && (
        <button type="button" onClick={() => window.confirm(`Delete the herb "${herb.name}"?`) && void onDelete()} className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
          Delete
        </button>
      )}
    </div>
  );
}
