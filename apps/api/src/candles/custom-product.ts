import type { PrismaService } from '../prisma/prisma.service';

/** The setting that holds the id of the "Custom Candle" product that custom candle order lines belong to. */
export const CUSTOM_PRODUCT_SETTING_KEY = 'custom_candle_product_id';
/** Set once the product has been put in the shop, so hiding it again later is respected. */
export const CUSTOM_PRODUCT_LISTED_SETTING_KEY = 'custom_candle_product_listed';
/** The page where customers build their candle. */
export const CUSTOM_CANDLE_PAGE = '/custom-candles';

export type CustomCandleListing = {
  /** Where the shop sends a customer who wants this product: the builder, not the cart. */
  customizeHref: string;
  /** The cheapest candle on offer, shown as "From $x". */
  customizeFromPrice: number;
};

export async function getCustomProductId(prisma: PrismaService): Promise<string | null> {
  const saved = await prisma.setting.findUnique({ where: { key: CUSTOM_PRODUCT_SETTING_KEY } });
  return saved?.value ?? null;
}

/**
 * Marks the custom candle product in a list of products, so the shop can show "Customize Candle" instead of "Add to Cart"
 * for it. Other products are returned as they are.
 */
export async function attachCustomCandleListing<T extends { id: string }>(
  prisma: PrismaService,
  products: T[],
): Promise<Array<T & Partial<CustomCandleListing>>> {
  const customId = await getCustomProductId(prisma);
  if (!customId || !products.some((product) => product.id === customId)) return products;

  const cheapest = await prisma.candleType.aggregate({ where: { isActive: true }, _min: { basePrice: true } });
  const fromPrice = cheapest._min.basePrice == null ? 0 : Number(cheapest._min.basePrice);
  return products.map((product) =>
    product.id === customId ? { ...product, customizeHref: CUSTOM_CANDLE_PAGE, customizeFromPrice: fromPrice } : product,
  );
}
