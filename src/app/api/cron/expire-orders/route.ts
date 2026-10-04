import { route, ok } from '@/lib/api';
import { expireStaleOrders, UNPAID_HOURS } from '@/lib/expire';
import { AppError } from '@/lib/errors';
import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Cancels unpaid QR Ph / PALLADIUM orders after UNPAID_HOURS (see lib/expire) so abandoned checkouts do not hold stock. Same CRON_SECRET rules as /api/cron/outbox. */
const handler = route(async (req) => {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || !given || !same(given, secret)) throw new AppError(401, 'UNAUTHORIZED', 'Invalid cron secret.');
  return ok(await expireStaleOrders(UNPAID_HOURS));
});
export const POST = handler;
export const GET = handler;
