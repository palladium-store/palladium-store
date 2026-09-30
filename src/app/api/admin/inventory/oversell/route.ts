import { adminRoute, ok, readJson } from '@/lib/api';
import { setOversell } from '@/lib/inventory';
import { z } from 'zod';

export const POST = adminRoute('MANAGE_SETTINGS', async (req, _c, user) => { await setOversell(user, z.object({ allow: z.boolean() }).parse(await readJson(req)).allow); return ok(); });
