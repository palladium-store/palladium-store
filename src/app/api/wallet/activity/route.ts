import { route, ok, clientIp } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { throttle } from '@/lib/auth';
import { isAddress } from '@/lib/chain-config';
import { walletActivity } from '@/lib/palladium/activity';

export const dynamic = 'force-dynamic';

/**
 * Public, read-only: the $PALLADIUM transfers of a wallet address, straight from the blockchain. Anyone can already read this
 * on a block explorer, so it needs no sign-in. Nothing from the store's database is included (no order numbers).
 */
export const GET = route(async (req) => {
  const address = new URL(req.url).searchParams.get('address') ?? '';
  if (!isAddress(address)) throw new AppError(422, 'BAD_ADDRESS', 'That is not a wallet address.');
  throttle(`wallet-activity:${clientIp(req)}`, 30, 60 * 1000);
  return ok(await walletActivity(address));
});
