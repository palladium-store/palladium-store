import { adminRoute, ok, readJson } from '@/lib/api';
import { transferSchema } from '@/lib/validators';
import { transferStock } from '@/lib/inventory';

export const POST = adminRoute('MANAGE_INVENTORY', async (req, _c, user) => { await transferStock(user, transferSchema.parse(await readJson(req))); return ok(); });
