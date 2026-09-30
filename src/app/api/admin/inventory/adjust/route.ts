import { adminRoute, ok, readJson } from '@/lib/api';
import { inventoryActionSchema } from '@/lib/validators';
import { adjustStock } from '@/lib/inventory';

export const POST = adminRoute('MANAGE_INVENTORY', async (req, _c, user) => ok(await adjustStock(user, inventoryActionSchema.parse(await readJson(req)))));
