import { route, ok, readJson, clientIp } from '@/lib/api';
import { throttleStrict } from '@/lib/auth';
import { createBuyQuote } from '@/lib/palladium/sale';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const body = z.object({ buyer: z.string().regex(/^0x[a-fA-F0-9]{40}$/), phpAmount: z.number().positive().max(10_000_000) });

/**
 * A signed, short-lived quote to buy $PALLADIUM. It moves nothing: the buyer's own wallet then calls the sale contract,
 * which checks this quote and delivers the tokens in the same transaction that takes the ETH.
 */
export const POST = route(async (req) => {
  await throttleStrict(`sale-quote:${clientIp(req)}`, 20, 10 * 60 * 1000);
  const b = body.parse(await readJson(req));
  return ok(await createBuyQuote(b.buyer, Math.round(b.phpAmount * 100)));
});
