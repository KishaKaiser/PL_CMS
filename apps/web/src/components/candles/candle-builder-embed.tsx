'use client';

import { useEffect, useState } from 'react';
import { CandleBuilder } from './candle-builder';
import type { CandleConfig } from './candle-types';

/** The candle builder as a block on any page: loads what is on offer, then shows the builder. */
export function CandleBuilderEmbed({ title }: { title?: string }) {
  const [config, setConfig] = useState<CandleConfig | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/proxy/candles/config')
      .then((res) => (res.ok ? (res.json() as Promise<CandleConfig>) : Promise.reject(new Error('failed'))))
      .then((data) => !cancelled && setConfig(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mb-8">
      {title?.trim() && <h2 className="mb-4 text-3xl font-bold">{title}</h2>}
      {config ? (
        <CandleBuilder config={config} />
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-gray-500">{failed ? 'The candle designer is not available right now.' : 'Loading the candle designer…'}</p>
      )}
    </section>
  );
}
