import { adminRoute, ok, readJson } from '@/lib/api';
import { setProductStatus } from '@/lib/products';
import { z } from 'zod';
export const POST = adminRoute('MANAGE_PRODUCTS', async (req, ctx: { params: { id: string } }, user) => {
  const b = z.object({ status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED', 'SOLD_OUT']) }).parse(await readJson(req));
  await setProductStatus(user, ctx.params.id, b.status);
  return ok();
});
