'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { addToCart } from '../../lib/cart';
import { CandlePreview } from './candle-preview';
import { formatMoney, priceCandle, type CandleConfig } from './candle-types';

const selectClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-gray-100 disabled:text-gray-400';

/**
 * The custom candle page: the customer picks a candle, a color (or two), a height and herbs, sees the candle change as they
 * choose, and adds it to the cart. The server works out the price again when the order is placed.
 */
export function CandleBuilder({ config }: { config: CandleConfig }) {
  const [typeId, setTypeId] = useState(config.types[0]?.id ?? '');
  const [colorId, setColorId] = useState('');
  const [color2Id, setColor2Id] = useState('');
  const [sizeId, setSizeId] = useState('');
  const [herbIds, setHerbIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const type = config.types.find((entry) => entry.id === typeId) ?? config.types[0];
  const color1 = config.colors.find((entry) => entry.id === colorId) ?? null;
  // The same color twice is just one color.
  const color2 = type?.allowTwoColors ? (config.colors.find((entry) => entry.id === color2Id && entry.id !== colorId) ?? null) : null;
  const size = type?.sizes.find((entry) => entry.id === sizeId) ?? null;
  const herbs = useMemo(() => (type?.allowHerbs ? config.herbs.filter((herb) => herbIds.includes(herb.id)) : []), [config.herbs, herbIds, type]);

  if (!type) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-gray-500">Custom candles are coming soon. Please check back shortly.</p>;
  }

  const needsSize = type.sizes.length > 0;
  const missing = !color1 ? 'Choose a color' : needsSize && !size ? 'Choose a height' : null;
  const unitPrice = priceCandle(type, { size, twoColors: !!color2, herbs });

  function changeType(nextId: string) {
    const next = config.types.find((entry) => entry.id === nextId);
    setTypeId(nextId);
    setSizeId('');
    if (!next?.allowTwoColors) setColor2Id('');
    if (!next?.allowHerbs) setHerbIds([]);
    setAdded(false);
  }

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setAdded(false);
    };
  }

  function handleAdd() {
    if (missing || !color1) return;
    const sortedHerbIds = config.herbs.filter((herb) => herbIds.includes(herb.id) && type.allowHerbs).map((herb) => herb.id);
    const colorText = color2 ? `${color1.name} (top) / ${color2.name} (bottom)` : color1.name;
    const details = [colorText, size?.label, herbs.length > 0 ? `Herbs: ${herbs.map((herb) => herb.name).join(', ')}` : null].filter(Boolean).join(' · ');
    addToCart({
      productId: config.productId,
      productName: `Custom ${type.name}`,
      productPrice: unitPrice,
      productType: 'PHYSICAL',
      currency: 'USD',
      quantity,
      custom: {
        key: [type.id, color1.id, color2?.id ?? '', size?.id ?? '', sortedHerbIds.join(',')].join('|'),
        typeId: type.id,
        colorId: color1.id,
        ...(color2 ? { color2Id: color2.id } : {}),
        ...(size ? { sizeId: size.id } : {}),
        herbIds: sortedHerbIds,
        details,
        swatches: [color1.hex, ...(color2 ? [color2.hex] : [])],
        weightOz: type.weightOz,
      },
    });
    setAdded(true);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="mx-auto w-full max-w-xs md:sticky md:top-6 md:max-w-none md:self-start">
        <CandlePreview
          photoUrl={type.photoUrl}
          waxMaskUrl={type.waxMaskUrl}
          color1={color1?.hex}
          color2={color2?.hex}
          heightPercent={size?.heightPercent}
          waxTopPercent={type.waxTopPercent}
          label={`${type.name}${color1 ? ` in ${color2 ? `${color1.name} and ${color2.name}` : color1.name}` : ''}`}
          emptyText="This candle does not have a picture yet."
        />
      </div>

      <div className="space-y-5">
        <label className="block text-sm font-medium text-gray-800">
          Candle
          <select value={type.id} onChange={(event) => changeType(event.target.value)} className={selectClass}>
            {config.types.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          {type.description && <span className="mt-1 block text-xs font-normal text-gray-500">{type.description}</span>}
        </label>

        <label className="block text-sm font-medium text-gray-800">
          Color
          <div className="flex items-center gap-3">
            <select value={colorId} onChange={(event) => change(setColorId)(event.target.value)} className={selectClass}>
              <option value="">Choose a color</option>
              {config.colors.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="mt-1 h-9 w-9 shrink-0 rounded-full border border-gray-300" style={{ background: color1?.hex ?? '#ffffff' }} />
          </div>
        </label>

        {type.allowTwoColors && (
          <label className="block text-sm font-medium text-gray-800">
            Second color (optional{type.twoColorExtra > 0 ? `, +${formatMoney(type.twoColorExtra)}` : ''})
            <div className="flex items-center gap-3">
              <select value={color2Id} onChange={(event) => change(setColor2Id)(event.target.value)} disabled={!color1} className={selectClass}>
                <option value="">None, just one color</option>
                {config.colors
                  .filter((entry) => entry.id !== colorId)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
              </select>
              <span aria-hidden="true" className="mt-1 h-9 w-9 shrink-0 rounded-full border border-gray-300" style={{ background: color2?.hex ?? 'repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 4px,#fff 4px,#fff 8px)' }} />
            </div>
            {color1 && color2 && <span className="mt-1 block text-xs font-normal text-gray-500">{color1.name} on top, {color2.name} on the bottom.</span>}
          </label>
        )}

        {needsSize && (
          <label className="block text-sm font-medium text-gray-800">
            Height
            <select value={sizeId} onChange={(event) => change(setSizeId)(event.target.value)} className={selectClass}>
              <option value="">Choose a height</option>
              {type.sizes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                  {entry.extraPrice > 0 ? ` (+${formatMoney(entry.extraPrice)})` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {type.allowHerbs && config.herbs.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium text-gray-800">Add herbs on top (optional)</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {config.herbs.map((herb) => (
                <label key={herb.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={herbIds.includes(herb.id)}
                    onChange={(event) => {
                      setHerbIds((current) => (event.target.checked ? [...current, herb.id] : current.filter((id) => id !== herb.id)));
                      setAdded(false);
                    }}
                  />
                  <span className="flex-1">{herb.name}</span>
                  {herb.price > 0 && <span className="text-xs text-gray-500">+{formatMoney(herb.price)}</span>}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex items-end justify-between gap-4 border-t pt-5">
          <div>
            <p className="text-sm text-gray-500">Price{quantity > 1 ? ' each' : ''}</p>
            <p className="text-3xl font-bold text-purple-700">{formatMoney(unitPrice)}</p>
            {quantity > 1 && <p className="text-sm text-gray-500">{formatMoney(unitPrice * quantity)} for {quantity}</p>}
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Quantity">
            <button type="button" onClick={() => change(setQuantity)(Math.max(1, quantity - 1))} className="h-9 w-9 rounded border text-lg font-bold hover:bg-gray-100" aria-label="One fewer">
              −
            </button>
            <span className="w-8 text-center text-sm" aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => change(setQuantity)(Math.min(20, quantity + 1))} className="h-9 w-9 rounded border text-lg font-bold hover:bg-gray-100" aria-label="One more">
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!!missing}
          className="w-full rounded-lg bg-purple-600 px-5 py-3 text-base font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Add to Cart
        </button>
        {missing && <p className="text-center text-sm text-gray-500">{missing} to add this candle to your cart.</p>}
        {added && (
          <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm text-green-800">
            Added to your cart.{' '}
            <Link href="/shop/cart" className="font-semibold underline">
              View cart
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
