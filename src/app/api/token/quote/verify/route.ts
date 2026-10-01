import { route, ok, readJson } from '@/lib/api';
import { z } from 'zod';
import { checkQuote } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

/** Tells the checkout whether a quote is still usable. The payment step re-verifies on the server regardless. */
export const POST = route(async (req) => {
  const { token } = z.object({ token: z.string().min(20).max(4000) }).parse(await readJson(req));
  const r = checkQuote(token);
  if (!r.ok) return ok({ status: r.reason });
  return ok({ status: 'ACTIVE', expiresAt: r.quote.expiresAt, secondsLeft: Math.max(0, Math.floor((r.quote.expiresAt - Date.now()) / 1000)) });
});
