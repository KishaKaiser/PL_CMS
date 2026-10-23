export interface CandleSizeOption {
  id: string;
  label: string;
  extraPrice: number;
  heightPercent: number;
}

export interface CandleTypeOption {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  photoUrl: string | null;
  waxMaskUrl: string | null;
  allowTwoColors: boolean;
  twoColorExtra: number;
  allowHerbs: boolean;
  weightOz: number | null;
  sizes: CandleSizeOption[];
}

export interface CandleColorOption {
  id: string;
  name: string;
  hex: string;
}

export interface CandleHerbOption {
  id: string;
  name: string;
  price: number;
  hex: string;
}

export interface CandleConfig {
  /** The hidden product that custom candle order lines belong to. */
  productId: string;
  types: CandleTypeOption[];
  colors: CandleColorOption[];
  herbs: CandleHerbOption[];
}

/**
 * The price of one candle as shown to the customer. The server works the price out again from the same choices when the
 * order is placed, so this is only for display.
 */
export function priceCandle(
  type: CandleTypeOption,
  choice: { size?: CandleSizeOption | null; twoColors: boolean; herbs: CandleHerbOption[] },
) {
  const cents =
    Math.round(type.basePrice * 100) +
    Math.round((choice.size?.extraPrice ?? 0) * 100) +
    (choice.twoColors ? Math.round(type.twoColorExtra * 100) : 0) +
    choice.herbs.reduce((sum, herb) => sum + Math.round(herb.price * 100), 0);
  return cents / 100;
}

export function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
