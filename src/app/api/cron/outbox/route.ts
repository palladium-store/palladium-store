import { route, ok } from '@/lib/api';
import { processOutbox } from '@/lib/email';
import { AppError } from '@/lib/errors';
import { timingSafeEqual } from 'node:crypto';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const dynamic = 'force-dynamic';

/**
 * Sends queued emails. Accepts `x-cron-secret: <CRON_SECRET>` (any scheduler, POST) or
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron, which calls with GET).
 */
const handler = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !given || !same(given, secret)) throw new AppError(401, 'UNAUTHORIZED', 'Invalid cron secret.');
  return ok(await processOutbox(100));
});
export const POST = handler;
export const GET = handler;
