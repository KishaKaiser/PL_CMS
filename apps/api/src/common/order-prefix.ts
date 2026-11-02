import { cleanOrderPrefix } from '@pl-cms/shared';
import type { PrismaService } from '../prisma/prisma.service';

/** The prefix in front of order numbers, from Store settings → Order Prefix (PL by default). */
export async function getOrderPrefix(prisma: PrismaService): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'store_ecommerce_settings' } });
    const saved = row?.value ? (JSON.parse(row.value) as { orderPrefix?: unknown }) : null;
    return cleanOrderPrefix(saved?.orderPrefix);
  } catch {
    return cleanOrderPrefix(undefined);
  }
}
