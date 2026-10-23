'use client';

import { useEffect, useRef, useState } from 'react';
import { CANDLE_STAGE_SIZE, loadCandleImage, renderCandle } from './candle-render';

/** The candle picture: the type's white photo, tinted with the chosen colors, at the chosen height, with herbs on top. */
export function CandlePreview({
  photoUrl,
  waxMaskUrl,
  color1,
  color2,
  heightPercent,
  herbs,
  label,
  emptyText = 'No picture yet',
}: {
  photoUrl: string | null;
  waxMaskUrl?: string | null;
  color1?: string | null;
  color2?: string | null;
  heightPercent?: number;
  herbs?: Array<{ id: string; hex: string }>;
  label: string;
  emptyText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [waxMask, setWaxMask] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setPhoto(null);
    setWaxMask(null);
    if (!photoUrl) return;
    loadCandleImage(photoUrl)
      .then((image) => !cancelled && setPhoto(image))
      .catch(() => !cancelled && setFailed(true));
    // A wax picture that cannot be loaded just means the whole candle is tinted.
    if (waxMaskUrl) loadCandleImage(waxMaskUrl).then((image) => !cancelled && setWaxMask(image)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [photoUrl, waxMaskUrl]);

  // A new herbs array arrives on every render, so the picture is redrawn when the herbs really change (herbKey), not then.
  const herbsRef = useRef(herbs);
  herbsRef.current = herbs;
  const herbKey = (herbs ?? []).map((herb) => `${herb.id}:${herb.hex}`).join('|');
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    renderCandle(canvas, { photo, waxMask, color1, color2, heightPercent, herbs: herbsRef.current });
  }, [photo, waxMask, color1, color2, heightPercent, herbKey]);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-gradient-to-b from-purple-50 to-white">
      {photoUrl && !failed ? (
        <canvas ref={canvasRef} width={CANDLE_STAGE_SIZE} height={CANDLE_STAGE_SIZE} role="img" aria-label={label} className="h-full w-full" />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-400">
          {failed ? 'The picture could not be loaded.' : emptyText}
        </div>
      )}
      {photoUrl && !photo && !failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Loading…</div>}
    </div>
  );
}
