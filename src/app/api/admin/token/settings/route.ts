import { adminRoute, ok, readJson } from '@/lib/api';
import { getSetting, setSetting } from '@/lib/settings';
import { audit } from '@/lib/audit';
import { parsePrice } from '@/lib/token-math';
import { z } from 'zod';

const schema = z.object({
  saleEnabled: z.boolean(),
  referencePricePhp: z.string().trim().max(30).refine((s) => s === '' || (() => { try { return parsePrice(s) > 0n; } catch { return false; } })(), 'Enter a price like 2 or 2.50.'),
  spreadPct: z.number().min(0).max(50),
  minPurchasePhp: z.number().int().min(1).max(1_000_000),
  maxPurchasePhp: z.number().int().min(1).max(1_000_000),
  quoteTtlSeconds: z.number().int().min(60).max(900),
}).refine((v) => v.maxPurchasePhp >= v.minPurchasePhp, { message: 'The maximum must be at least the minimum.', path: ['maxPurchasePhp'] });

/** Token sale settings. Super Admin only (MANAGE_TOKEN). The audit entry records every old and new value. */
export const PUT = adminRoute('MANAGE_TOKEN', async (req, _ctx, user) => {
  const next = schema.parse(await readJson(req));
  const prev = await getSetting('tokenSale');
  await setSetting('tokenSale', next);
  const changes = (Object.keys(next) as (keyof typeof next)[]).filter((k) => String(prev[k]) !== String(next[k])).map((k) => `${k}: ${JSON.stringify(prev[k])} -> ${JSON.stringify(next[k])}`);
  await audit(user, 'TOKEN_SALE_SETTINGS', 'Settings', 'tokenSale', changes.length ? `Token sale settings: ${changes.join('; ')}` : 'Token sale settings saved (no changes)');
  return ok();
});
