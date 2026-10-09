import 'server-only';
import { TRANSFER_TOPIC, addressTopic, hexToBigInt } from '@/lib/chain-config';
import { getWalletConfig } from '@/lib/token';
import { chainRpc, rpcUrlsFor } from './chain-rpc';
import { paymentWalletAddress, requiredConfirmations } from './live-config';
import { saleContractAddress } from './sale';
import { scanWindows, toActivity, type ActivityEntry, type RawLog } from './activity-core';

/**
 * A wallet's $PALLADIUM history, read directly from Robinhood Chain (no explorer, no database): the Transfer logs where the
 * wallet is sender or recipient. Because the chain is the record, the history is complete even if the customer closed the
 * browser while a transaction was being mined.
 *
 *   TOKEN_DEPLOY_BLOCK   optional: the token's deployment block. With it the whole history is scanned; without it, the last
 *                        WINDOWS x SPAN blocks (about 5 months).
 */
const SPAN = 9_000_000n;
const WINDOWS = 9;
const LIMIT = 25;
const CACHE_MS = 15_000;

export interface WalletActivity {
  configured: boolean;
  entries: ActivityEntry[];
  decimals: number;
  symbol: string;
  chainId: number;
  explorerUrl: string;
  confirmationsRequired: number;
  /** True when older history exists beyond what was scanned. */
  partial: boolean;
}

const cache = new Map<string, { at: number; data: WalletActivity }>();

export async function walletActivity(address: string): Promise<WalletActivity> {
  const w = getWalletConfig();
  const base = { decimals: w.decimals, symbol: w.symbol, chainId: w.chain.chainId, explorerUrl: w.chain.explorerUrl, confirmationsRequired: requiredConfirmations() };
  if (!w.contract) return { configured: false, entries: [], partial: false, ...base };

  const key = `${w.chain.chainId}:${w.contract}:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const urls = rpcUrlsFor(w.chain);
  const call = <T>(method: string, params: unknown[]) => chainRpc<T>(urls, w.chain.chainId, method, params);
  const latest = hexToBigInt(await call<string>('eth_blockNumber', []));
  const deployRaw = (process.env.TOKEN_DEPLOY_BLOCK ?? '').trim();
  const floor = /^\d+$/.test(deployRaw) ? BigInt(deployRaw) : 0n;
  const windows = scanWindows(latest, floor, SPAN, floor > 0n ? 1000 : WINDOWS);
  const me = addressTopic(address);

  const logs: RawLog[] = [];
  let scanned = 0;
  for (const win of windows) {
    const range = { address: w.contract, fromBlock: `0x${win.from.toString(16)}`, toBlock: `0x${win.to.toString(16)}` };
    const [out, inc] = await Promise.all([
      call<RawLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, me] }]),
      call<RawLog[]>('eth_getLogs', [{ ...range, topics: [TRANSFER_TOPIC, null, me] }]),
    ]);
    logs.push(...out, ...inc);
    scanned++;
    if (logs.length >= LIMIT) break;
  }
  const last = windows[scanned - 1];
  const partial = !!last && last.from > floor;

  const entries = toActivity(logs, { address, contract: w.contract, paymentWallet: paymentWalletAddress(), latestBlock: latest, saleContract: saleContractAddress() }).slice(0, LIMIT);
  const blocks = Array.from(new Set(entries.map((e) => e.block)));
  const times = new Map<number, number>();
  await Promise.all(blocks.map(async (b) => {
    try {
      const blk = await call<{ timestamp: string } | null>('eth_getBlockByNumber', [`0x${b.toString(16)}`, false]);
      if (blk?.timestamp) times.set(b, Number(hexToBigInt(blk.timestamp)));
    } catch { /* time stays unknown */ }
  }));
  for (const e of entries) e.time = times.get(e.block) ?? null;

  const data: WalletActivity = { configured: true, entries, partial, ...base };
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), data });
  return data;
}
