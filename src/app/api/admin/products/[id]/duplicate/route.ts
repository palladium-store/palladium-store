import { adminRoute, ok } from '@/lib/api';
import { duplicateProduct } from '@/lib/products';
export const POST = adminRoute('MANAGE_PRODUCTS', async (_req, ctx: { params: { id: string } }, user) => { const c = await duplicateProduct(user, ctx.params.id); return ok({ id: c.id }, 201); });
