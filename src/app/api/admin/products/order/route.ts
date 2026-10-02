import { z } from 'zod';
import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';

const schema = z.object({ ids: z.array(z.string().min(1)).min(1).max(2000) });

/** Saves the storefront order: position in `ids` becomes sortOrder (1-based). Products not listed keep their place after the listed ones. */
export const PUT = adminRoute('MANAGE_PRODUCTS', async (req, _c, user) => {
  const { ids } = schema.parse(await readJson(req));
  const unique = Array.from(new Set(ids));
  await prisma.$transaction(unique.map((id, i) => prisma.product.updateMany({ where: { id }, data: { sortOrder: i + 1 } })));
  await audit(user, 'PRODUCTS_REORDERED', 'Product', 'order', `Reordered ${unique.length} products`);
  return ok({ count: unique.length });
});
