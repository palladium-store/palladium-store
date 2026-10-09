import 'server-only';
import { decodeEventLog, toEventSelector, type Hex } from 'viem';
import { formatUnits, hexToBigInt } from '@/lib/chain-config';
import { getWalletConfig } from '@/lib/token';
import { getCurrentPrice } from '@/lib/pricing';
import { getSetting, type TokenSaleSettings } from '@/lib/settings';
import { formatPrice } from '@/lib/token-math';
import { chainRpc, rpcUrlsFor } from './chain-rpc';
import { scanWindows } from './activity-core';
import { SALE_ABI, ethPhpRate, readSaleState, saleContractAddress, saleMasterSwitch, signerAddress } from './sale';
import artifact from './sale-artifact.json';

/** Everything Admin > Token shows, as plain strings (no bigints) so it can go to the browser. No secrets. */
export interface SaleOverview {
  network: string; chainId: number; explorerUrl: string; token: string | null; decimals: number; symbol: string;
  saleContract: string | null; signerAddress: string | null; masterSwitch: boolean; priceSource: string;
  settings: TokenSaleSettings;
  price: { php: string; label: string } | null; priceProblem: string | null;
  ethPhp: { rate: string; sources: string[] } | null;
  state: null | {
    paused: boolean; owner: string; treasury: string; quoteSigner: string; token: string; inventory: string;
    minWeiPerToken: string; maxTokensPerPurchase: string; maxTokensPerDay: string; soldToday: string; maxQuoteLifetime: number;
  };
  stateError: string | null;
  purchases: { hash: string; block: number; buyer: string; tokens: string; eth: string }[];
  totals: { count: number; tokens: string; eth: string } | null;
  artifact: { sourceSha256: string; compiler: string };
}

const PURCHASED = toEventSelector('Purchased(address,bytes32,uint256,uint256)');

export async function saleOverview(): Promise<SaleOverview> {
  const w = getWalletConfig();
  const settings = await getSetting('tokenSale');
  const saleContract = saleContractAddress();
  const [price, rate] = await Promise.all([getCurrentPrice(), ethPhpRate().catch(() => null)]);
  const out: SaleOverview = {
    network: w.chain.name, chainId: w.chain.chainId, explorerUrl: w.chain.explorerUrl, token: w.contract, decimals: w.decimals, symbol: w.symbol,
    saleContract, signerAddress: signerAddress(), masterSwitch: saleMasterSwitch(), priceSource: (process.env.TOKEN_PRICE_SOURCE ?? 'none').trim() || 'none',
    settings,
    price: price.available ? { php: formatPrice(price.priceScaled, 6), label: price.source === 'admin' ? 'set in Admin > Token' : price.source } : null,
    priceProblem: price.available ? null : price.reason,
    ethPhp: rate ? { rate: formatPrice(rate.rate, 2), sources: rate.sources } : null,
    state: null, stateError: null, purchases: [], totals: null,
    artifact: { sourceSha256: artifact.sourceSha256, compiler: artifact.compiler },
  };
  if (!saleContract) return out;
  try {
    const s = await readSaleState(true);
    out.state = {
      paused: s.paused, owner: s.owner, treasury: s.treasury, quoteSigner: s.quoteSigner, token: s.token,
      inventory: formatUnits(s.inventory, w.decimals, 4), minWeiPerToken: s.minWeiPerToken.toString(),
      maxTokensPerPurchase: formatUnits(s.maxTokensPerPurchase, w.decimals, 0), maxTokensPerDay: formatUnits(s.maxTokensPerDay, w.decimals, 0),
      soldToday: formatUnits(s.currentDay === BigInt(Math.floor(Date.now() / 86_400_000)) ? s.soldToday : 0n, w.decimals, 4), maxQuoteLifetime: Number(s.maxQuoteLifetime),
    };
  } catch (e) { out.stateError = e instanceof Error ? e.message : 'Could not read the sale contract.'; return out; }

  try {
    const urls = rpcUrlsFor(w.chain);
    const latest = hexToBigInt(await chainRpc<string>(urls, w.chain.chainId, 'eth_blockNumber', []));
    const logs: { blockNumber: string; transactionHash: string; topics: Hex[]; data: Hex }[] = [];
    for (const win of scanWindows(latest, 0n, 9_000_000n, 4)) {
      logs.push(...await chainRpc<typeof logs>(urls, w.chain.chainId, 'eth_getLogs', [{ address: saleContract, topics: [PURCHASED], fromBlock: `0x${win.from.toString(16)}`, toBlock: `0x${win.to.toString(16)}` }]));
      if (logs.length >= 50) break;
    }
    let tokens = 0n, wei = 0n;
    const rows = logs.map((l) => {
      const d = decodeEventLog({ abi: SALE_ABI, data: l.data, topics: l.topics as [Hex, ...Hex[]] }) as unknown as { args: { buyer: string; tokenAmount: bigint; weiAmount: bigint } };
      tokens += d.args.tokenAmount; wei += d.args.weiAmount;
      return { hash: l.transactionHash, block: Number(hexToBigInt(l.blockNumber)), buyer: d.args.buyer, tokens: formatUnits(d.args.tokenAmount, w.decimals, 4), eth: formatUnits(d.args.weiAmount, 18, 6) };
    }).sort((a, b) => b.block - a.block);
    out.purchases = rows.slice(0, 50);
    out.totals = { count: rows.length, tokens: formatUnits(tokens, w.decimals, 4), eth: formatUnits(wei, 18, 6) };
  } catch (e) { console.error('[token-sale admin] purchases', e); }
  return out;
}
