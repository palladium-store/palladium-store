import 'server-only';
import { randomBytes } from 'node:crypto';
import { decodeFunctionResult, encodeFunctionData, type Abi, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { AppError } from '@/lib/errors';
import { formatUnits, isAddress, sameAddress } from '@/lib/chain-config';
import { getWalletConfig } from '@/lib/token';
import { getCurrentPrice } from '@/lib/pricing';
import { getSetting } from '@/lib/settings';
import { formatPrice } from '@/lib/token-math';
import { chainRpc, rpcUrlsFor } from './chain-rpc';
import { meetsPriceFloor, priceWithSpread, tokensForPhp, weiForPhp } from './sale-math';
import { ethPhpRate } from './eth-rate';
import artifact from './sale-artifact.json';

/**
 * Server side of the $PALLADIUM sale (contract: contracts/contracts/PalladiumTokenSale.sol).
 *
 * The server's only power is to sign short-lived quotes with TOKEN_SALE_SIGNER_KEY. It never holds tokens or ETH and never
 * sends transactions: the buyer's own wallet calls the contract, which delivers tokens and forwards the ETH to the treasury
 * atomically. Even with a stolen signing key, the contract's owner-set price floor and caps bound what could be sold.
 *
 *   TOKEN_SALE_ENABLED            "true" is required for any quote (master switch, default off)
 *   TOKEN_SALE_CONTRACT_ADDRESS   the deployed PalladiumTokenSale
 *   TOKEN_SALE_SIGNER_KEY         the quote-signing private key (0x + 64 hex). Server secret: never logged or sent anywhere.
 * Price, spread, limits and the admin on/off switch live in Admin > Token (settings key "tokenSale").
 */
export const SALE_ABI = artifact.abi as Abi;
const env = (k: string) => (process.env[k] ?? '').trim();

export function saleContractAddress(): string | null {
  const a = env('TOKEN_SALE_CONTRACT_ADDRESS');
  return isAddress(a) ? a : null;
}
let signerCache: { key: string; account: PrivateKeyAccount } | null = null;
function signer(): PrivateKeyAccount | null {
  const k = env('TOKEN_SALE_SIGNER_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
  if (signerCache?.key !== k) signerCache = { key: k, account: privateKeyToAccount(k as Hex) };
  return signerCache.account;
}
/** The public address of the quote-signing key (safe to show; the key itself never leaves the server). */
export const signerAddress = () => signer()?.address ?? null;
export const saleMasterSwitch = () => env('TOKEN_SALE_ENABLED').toLowerCase() === 'true';

/** Whether the store offers buying at all (no chain calls; the quote endpoint checks the contract itself). */
export async function saleOffered(): Promise<boolean> {
  const w = getWalletConfig();
  if (!saleMasterSwitch() || !w.contract || !saleContractAddress() || !signer()) return false;
  return (await getSetting('tokenSale')).saleEnabled;
}

// ---------------- contract state ----------------

export interface SaleState {
  paused: boolean; quoteSigner: string; owner: string; treasury: string; token: string;
  inventory: bigint; minWeiPerToken: bigint; maxTokensPerPurchase: bigint; maxTokensPerDay: bigint;
  soldToday: bigint; currentDay: bigint; maxQuoteLifetime: bigint; unit: bigint;
}
const VIEWS = ['paused', 'quoteSigner', 'owner', 'treasury', 'token', 'inventory', 'minWeiPerToken', 'maxTokensPerPurchase', 'maxTokensPerDay', 'soldToday', 'currentDay', 'maxQuoteLifetime', 'unit'] as const;
let stateCache: { at: number; addr: string; state: SaleState } | null = null;

export async function readSaleState(force = false): Promise<SaleState> {
  const addr = saleContractAddress();
  if (!addr) throw new AppError(503, 'SALE_NOT_CONFIGURED', 'The token sale is not set up.');
  if (!force && stateCache && stateCache.addr === addr && Date.now() - stateCache.at < 10_000) return stateCache.state;
  const { chain } = getWalletConfig();
  const urls = rpcUrlsFor(chain);
  const code = await chainRpc<string>(urls, chain.chainId, 'eth_getCode', [addr, 'latest']);
  if (!code || code === '0x') throw new AppError(503, 'SALE_NOT_DEPLOYED', `No sale contract exists at that address on ${chain.name}.`);
  const values = await Promise.all(VIEWS.map(async (fn) => {
    const data = encodeFunctionData({ abi: SALE_ABI, functionName: fn });
    const raw = await chainRpc<Hex>(urls, chain.chainId, 'eth_call', [{ to: addr, data }, 'latest']);
    return decodeFunctionResult({ abi: SALE_ABI, functionName: fn, data: raw });
  }));
  const state = Object.fromEntries(VIEWS.map((k, i) => [k, values[i]])) as unknown as SaleState;
  stateCache = { at: Date.now(), addr, state };
  return state;
}

export { ethPhpRate } from './eth-rate';

// ---------------- quote ----------------

export interface BuyQuote {
  contract: string; chainId: number; buyer: string;
  tokenAmount: string; weiAmount: string; deadline: number; quoteId: Hex; signature: Hex;
  /** For display: everything the buyer is shown before signing. */
  breakdown: {
    phpAmount: string; referencePricePhp: string; spreadPct: number; unitPricePhp: string; tokens: string; eth: string;
    ethPhp: string; rateSources: string[]; priceLabel: string; expiresAt: number;
  };
}

const QUOTE_TYPES = { Quote: [
  { name: 'buyer', type: 'address' }, { name: 'tokenAmount', type: 'uint256' }, { name: 'weiAmount', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }, { name: 'quoteId', type: 'bytes32' },
] } as const;

export async function createBuyQuote(buyer: string, phpCentavos: number): Promise<BuyQuote> {
  if (!isAddress(buyer)) throw new AppError(422, 'BAD_ADDRESS', 'Connect a valid wallet first.');
  const w = getWalletConfig();
  const settings = await getSetting('tokenSale');
  const contract = saleContractAddress();
  const account = signer();
  if (!(await saleOffered()) || !contract || !account || !w.contract) throw new AppError(503, 'SALE_CLOSED', 'Buying $PALLADIUM is not open right now.');
  if (!Number.isSafeInteger(phpCentavos) || phpCentavos < settings.minPurchasePhp * 100 || phpCentavos > settings.maxPurchasePhp * 100) {
    throw new AppError(422, 'BAD_AMOUNT', `Enter an amount from ₱${settings.minPurchasePhp.toLocaleString('en-PH')} to ₱${settings.maxPurchasePhp.toLocaleString('en-PH')}.`);
  }

  const [price, rate, state] = await Promise.all([getCurrentPrice(Date.now(), 'sale'), ethPhpRate(), readSaleState()]);
  if (!price.available) throw new AppError(503, 'NO_PRICE', 'The token price is not available right now.');
  if (!rate) throw new AppError(503, 'NO_ETH_RATE', 'The ETH exchange rate is not available right now. Please try again shortly.');
  // The contract must be the one we expect, signing with our key, for our token, and open.
  if (!sameAddress(state.token, w.contract)) throw new AppError(503, 'SALE_MISCONFIGURED', 'The token sale is temporarily unavailable.');
  if (!sameAddress(state.quoteSigner, account.address)) throw new AppError(503, 'SALE_MISCONFIGURED', 'The token sale is temporarily unavailable.');
  if (state.paused) throw new AppError(503, 'SALE_PAUSED', 'The token sale is paused right now.');

  const spreadBps = Math.round(settings.spreadPct * 100);
  const unitPrice = priceWithSpread(price.priceScaled, spreadBps);
  const tokenAmount = tokensForPhp(BigInt(phpCentavos), unitPrice, w.decimals);
  const weiAmount = weiForPhp(BigInt(phpCentavos), rate.rate);
  if (tokenAmount <= 0n) throw new AppError(422, 'BAD_AMOUNT', 'That amount is too small.');
  if (tokenAmount > state.maxTokensPerPurchase) throw new AppError(422, 'OVER_LIMIT', `One purchase can be at most ${formatUnits(state.maxTokensPerPurchase, w.decimals, 0)} ${w.symbol}.`);
  const today = BigInt(Math.floor(Date.now() / 86_400_000));
  const soldToday = state.currentDay === today ? state.soldToday : 0n;
  if (soldToday + tokenAmount > state.maxTokensPerDay) throw new AppError(409, 'DAILY_LIMIT', 'Today\'s sale limit has been reached. Please try again tomorrow.');
  if (tokenAmount > state.inventory) throw new AppError(409, 'SOLD_OUT', 'Not enough $PALLADIUM is available for sale right now.');
  if (!meetsPriceFloor(weiAmount, tokenAmount, w.decimals, state.minWeiPerToken)) {
    // The peso price converts to less ETH than the owner's on-chain floor allows. Refuse rather than sell below the floor.
    console.error('[token-sale] quote below the contract price floor', formatPrice(rate.rate, 2), formatPrice(unitPrice, 6));
    throw new AppError(503, 'BELOW_FLOOR', 'The token sale is temporarily unavailable.');
  }

  const ttl = Math.min(Math.max(settings.quoteTtlSeconds, 60), 900, Number(state.maxQuoteLifetime) - 30);
  if (ttl < 30) throw new AppError(503, 'SALE_MISCONFIGURED', 'The token sale is temporarily unavailable.');
  const deadline = Math.floor(Date.now() / 1000) + ttl;
  const quoteId = `0x${randomBytes(32).toString('hex')}` as Hex;
  const message = { buyer: buyer as Hex, tokenAmount, weiAmount, deadline: BigInt(deadline), quoteId };
  const signature = await account.signTypedData({
    domain: { name: 'PalladiumTokenSale', version: '1', chainId: w.chain.chainId, verifyingContract: contract as Hex },
    types: QUOTE_TYPES, primaryType: 'Quote', message,
  });

  return {
    contract, chainId: w.chain.chainId, buyer, tokenAmount: tokenAmount.toString(), weiAmount: weiAmount.toString(), deadline, quoteId, signature,
    breakdown: {
      phpAmount: (phpCentavos / 100).toFixed(2), referencePricePhp: formatPrice(price.priceScaled, 6), spreadPct: settings.spreadPct,
      unitPricePhp: formatPrice(unitPrice, 6), tokens: formatUnits(tokenAmount, w.decimals, 6), eth: formatUnits(weiAmount, 18, 8),
      ethPhp: formatPrice(rate.rate, 2), rateSources: rate.sources,
      priceLabel: price.fixed ? 'a fixed rate set by Palladium, not a market price' : 'live market price', expiresAt: deadline * 1000,
    },
  };
}
