import { adminRoute, ok, readJson } from '@/lib/api';
import { setSetting } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { AppError } from '@/lib/errors';
import { z } from 'zod';

const method = z.object({ enabled: z.boolean(), instructions: z.string().max(1000) });
const schemas = {
  store: z.object({ name: z.string().min(1).max(80), email: z.string().email(), phone: z.string().max(40), address: z.string().max(300), facebook: z.string().max(200).optional(), instagram: z.string().max(200).optional() }),
  payments: z.object({ GCASH: method, MAYA: method, CARD: method, BANK_TRANSFER: method, COD: method }),
  content: z.object({
    hero: z.object({ eyebrow: z.string().max(120), title: z.string().min(1).max(120), subtitle: z.string().max(300), cta: z.string().max(40), image: z.string().max(500) }),
    banners: z.array(z.object({ title: z.string().max(80), text: z.string().max(200), href: z.string().max(200), cta: z.string().max(40) })).max(4),
    brandStory: z.object({ title: z.string().max(140), body: z.string().max(3000) }), announcement: z.string().max(160),
    policies: z.array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), title: z.string().max(80), body: z.string().max(10000) })).max(12),
  }),
} as const;
export const PUT = adminRoute('MANAGE_SETTINGS', async (req, ctx: { params: { key: string } }, user) => {
  const key = ctx.params.key as keyof typeof schemas;
  if (!schemas[key]) throw new AppError(404, 'NOT_FOUND', 'Unknown settings section.');
  await setSetting(key, schemas[key].parse(await readJson(req)));
  await audit(user, 'SETTINGS_UPDATED', 'Settings', key, `Updated ${key} settings`);
  return ok();
});
