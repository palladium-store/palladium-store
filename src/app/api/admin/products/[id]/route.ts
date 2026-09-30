import { adminRoute, ok, readJson } from '@/lib/api';
import { productSchema } from '@/lib/validators';
import { updateProduct, deleteProduct } from '@/lib/products';

export const PUT = adminRoute('MANAGE_PRODUCTS', async (req, ctx: { params: { id: string } }, user) => {
  await updateProduct(user, ctx.params.id, productSchema.parse(await readJson(req)));
  return ok();
});
export const DELETE = adminRoute('MANAGE_PRODUCTS', async (_req, ctx: { params: { id: string } }, user) => { await deleteProduct(user, ctx.params.id); return ok(); });
