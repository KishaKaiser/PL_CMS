import { normalizeSlug } from '../admin/admin-content/cms-content.util';
import type { PrismaService } from '../prisma/prisma.service';

/** /shop/cart and /shop/checkout are pages of their own, so a product with one of these addresses could never be reached. */
export const RESERVED_PRODUCT_SLUGS = new Set(['cart', 'checkout']);

const MAX_SLUG_LENGTH = 80;

/** "Crystal Ball (Large)!" becomes "crystal-ball-large". */
export function productSlugFromText(text: string) {
  const slug = normalizeSlug(text).slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  return slug || 'product';
}

/**
 * A web address for a product that no other product uses: the text as a slug, with -2, -3 ... added if it is taken.
 * `excludeId` lets a product keep its own address.
 */
export async function uniqueProductSlug(prisma: Pick<PrismaService, 'product'>, text: string, excludeId?: string) {
  const base = productSlugFromText(text);
  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    if (RESERVED_PRODUCT_SLUGS.has(candidate)) continue;
    const taken = await prisma.product.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  // Practically unreachable: fall back to something that cannot clash.
  return `${base}-${Date.now().toString(36)}`;
}
