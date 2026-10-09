import { TRANSFER_TOPIC, hexToBigInt, sameAddress, topicToAddress } from '@/lib/chain-config';

/**
 * Pure part of the wallet activity feed: turns $PALLADIUM Transfer logs into readable entries. No network access, unit tested.
 * Every entry is a confirmed-on-chain fact (it is a log in a mined block); `confirmations` says how deep it is.
 */
export interface RawLog { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string; removed?: boolean }

export type ActivityKind = 'received' | 'sent' | 'paid-palladium' | 'from-palladium' | 'self';
export interface ActivityEntry {
  hash: string;
  logIndex: number;
  block: number;
  /** Unix seconds, when known. */
  time: number | null;
  kind: ActivityKind;
  /** The other side of the transfer. */
  counterparty: string;
  /** Smallest units, decimal string. */
  amount: string;
  confirmations: number;
}

export interface ActivityContext { address: string; contract: string; paymentWallet: string | null; latestBlock: bigint }

/** Keeps only genuine Transfer logs of the token that involve `address`, newest first, each log once. */
export function toActivity(logs: RawLog[], c: ActivityContext): ActivityEntry[] {
  const seen = new Set<string>();
  const out: ActivityEntry[] = [];
  for (const l of logs) {
    if (l.removed || !sameAddress(l.address, c.contract)) continue;
    if (!l.topics || l.topics.length < 3 || l.topics[0].toLowerCase() !== TRANSFER_TOPIC) continue;
    const from = topicToAddress(l.topics[1]), to = topicToAddress(l.topics[2]);
    const fromMe = sameAddress(from, c.address), toMe = sameAddress(to, c.address);
    if (!fromMe && !toMe) continue;
    const key = `${l.transactionHash.toLowerCase()}:${hexToBigInt(l.logIndex)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind: ActivityKind = fromMe && toMe ? 'self'
      : fromMe ? (c.paymentWallet && sameAddress(to, c.paymentWallet) ? 'paid-palladium' : 'sent')
      : (c.paymentWallet && sameAddress(from, c.paymentWallet) ? 'from-palladium' : 'received');
    const block = hexToBigInt(l.blockNumber);
    out.push({
      hash: l.transactionHash.toLowerCase(), logIndex: Number(hexToBigInt(l.logIndex)), block: Number(block), time: null, kind,
      counterparty: fromMe ? to : from, amount: hexToBigInt(l.data).toString(),
      confirmations: Math.max(0, Number(c.latestBlock - block + 1n)),
    });
  }
  return out.sort((a, b) => b.block - a.block || b.logIndex - a.logIndex);
}

/**
 * Block windows to scan, newest first. The RPC accepts at most 10,000,000 blocks per eth_getLogs request (about 17 days on
 * Robinhood Chain), so the range is split. `floor` is the token's deployment block when known.
 */
export function scanWindows(latest: bigint, floor: bigint, span: bigint, maxWindows: number): { from: bigint; to: bigint }[] {
  const out: { from: bigint; to: bigint }[] = [];
  let to = latest;
  while (to >= floor && out.length < maxWindows) {
    const from = to - span + 1n > floor ? to - span + 1n : floor;
    out.push({ from, to });
    if (from === floor) break;
    to = from - 1n;
  }
  return out;
}
