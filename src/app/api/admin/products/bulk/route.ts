import { adminRoute, ok, readJson } from '@/lib/api';
import { bulkProducts, bulkSchema } from '@/lib/products';

export const POST = adminRoute('MANAGE_PRODUCTS', async (req, _c, user) => ok(await bulkProducts(user, bulkSchema.parse(await readJson(req)))));
