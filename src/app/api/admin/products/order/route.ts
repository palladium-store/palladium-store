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

const moveSchema = z.object({ id: z.string().min(1), to: z.enum(['up', 'down', 'top', 'bottom']) });

/** Moves one product a step (or to the top/bottom) of the storefront order, then renumbers everything 1..n. */
export const PATCH = adminRoute('MANAGE_PRODUCTS', async (req, _c, user) => {
  const { id, to } = moveSchema.parse(await readJson(req));
  const all = await prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }], select: { id: true, status: true } });
  const live = all.filter((p) => p.status !== 'ARCHIVED').map((p) => p.id);
  const rest = all.filter((p) => p.status === 'ARCHIVED').map((p) => p.id);
  const from = live.indexOf(id);
  if (from < 0) return ok({ moved: false });
  const target = to === 'top' ? 0 : to === 'bottom' ? live.length - 1 : to === 'up' ? from - 1 : from + 1;
  if (target < 0 || target >= live.length || target === from) return ok({ moved: false });
  const next = live.slice(); const [item] = next.splice(from, 1); next.splice(target, 0, item);
  const order = [...next, ...rest];
  await prisma.$transaction(order.map((pid, i) => prisma.product.update({ where: { id: pid }, data: { sortOrder: i + 1 } })));
  await audit(user, 'PRODUCTS_REORDERED', 'Product', id, `Moved a product ${to}`);
  return ok({ moved: true });
});
