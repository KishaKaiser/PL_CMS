import type { CandleConfig } from '../components/candles/candle-types';
import { fetchApi } from './server-api';

/** What the custom candle page offers (candle types, colors, herbs), or null when it cannot be loaded. */
export async function getCandleConfig(): Promise<CandleConfig | null> {
  try {
    const res = await fetchApi('/candles/config', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as CandleConfig;
  } catch {
    return null;
  }
}
