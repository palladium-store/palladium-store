import { route, ok } from '@/lib/api';
import { processOutbox } from '@/lib/email';
import { AppError } from '@/lib/errors';

/** Call from a scheduler (cron, GitHub Actions, host cron) with header `x-cron-secret`. */
export const POST = route(async (req) => {
  if (!process.env.CRON_SECRET || req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) throw new AppError(401, 'UNAUTHORIZED', 'Invalid cron secret.');
  return ok(await processOutbox(100));
});
