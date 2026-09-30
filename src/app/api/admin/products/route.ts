import { adminRoute, ok, readJson } from '@/lib/api';
import { productSchema } from '@/lib/validators';
import { createProduct } from '@/lib/products';

export const POST = adminRoute('MANAGE_PRODUCTS', async (req, _c, user) => {
  const p = await createProduct(user, productSchema.parse(await readJson(req)));
  return ok({ id: p.id, slug: p.slug }, 201);
});
