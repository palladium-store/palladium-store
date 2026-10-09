import 'server-only';
import { isAddress, type PalladiumClientConfig } from '@/lib/chain-config';
import { getWalletConfig } from '@/lib/token';
import { tokenCheckoutState } from '@/lib/pricing';
import { demoEnabled } from './demo-server';
import { rpcUrlsFor } from './chain-rpc';
import { saleContractAddress, saleOffered } from './sale';

/**
 * Live $PALLADIUM payment configuration. Everything comes from environment variables; nothing is invented.
 *
 *   TOKEN_NETWORK                      mainnet | testnet (Robinhood Chain presets in chain-config.ts)
 *   TOKEN_CONTRACT_ADDRESS             ERC-20 contract of $PALLADIUM on that chain
 *   TOKEN_DECIMALS                     token decimals (default 18)
 *   PALLADIUM_PAYMENT_WALLET_ADDRESS   Palladium's receiving wallet (customers transfer tokens here)
 *   TOKEN_RPC_URL                      JSON-RPC endpoint(s) the server reads the chain with, comma-separated, tried in
 *                                      order; the chain's public RPC is always the last fallback
 *   TOKEN_CONFIRMATIONS                blocks that must follow a payment before it counts (default 3)
 *   TOKEN_CHECKOUT_ENABLED + a reviewed price (see pricing.ts) switch the checkout option on.
 *
 * Wallet connection (header, token page, account) works as soon as the chain preset exists, which is always.
 * Payment needs all of the above; until then the checkout never offers $PALLADIUM and the API refuses it.
 */
export interface LivePaymentConfig {
  chainId: number;
  chainName: string;
  /** Tried in order: TOKEN_RPC_URL entries, then the chain's public RPC. */
  rpcUrls: string[];
  explorerUrl: string;
  contract: string;
  decimals: number;
  symbol: string;
  paymentWallet: string;
  confirmations: number;
}

const env = (k: string) => (process.env[k] ?? '').trim();

/** TOKEN_CONFIRMATIONS, 1 to 64, default 3. */
export function requiredConfirmations(): number {
  const conf = Number(env('TOKEN_CONFIRMATIONS') || 3);
  return Number.isInteger(conf) && conf >= 1 && conf <= 64 ? conf : 3;
}

export function paymentWalletAddress(): string | null {
  const w = env('PALLADIUM_PAYMENT_WALLET_ADDRESS');
  return isAddress(w) ? w : null;
}

/** The static part of the live configuration, or null while the contract or the receiving wallet is missing. */
export function getLivePaymentConfig(): LivePaymentConfig | null {
  const w = getWalletConfig();
  const paymentWallet = paymentWalletAddress();
  if (!w.contract || !paymentWallet) return null;
  return {
    chainId: w.chain.chainId, chainName: w.chain.name, rpcUrls: rpcUrlsFor(w.chain), explorerUrl: w.chain.explorerUrl,
    contract: w.contract, decimals: w.decimals, symbol: w.symbol, paymentWallet,
    confirmations: requiredConfirmations(),
  };
}

/** True when a real $PALLADIUM payment can be offered: configuration complete, checkout switched on, price reviewed. */
export async function livePaymentEnabled(): Promise<boolean> {
  if (!getLivePaymentConfig()) return false;
  return (await tokenCheckoutState()).enabled;
}

/** What the store layout hands to the browser. The real wallet is the default; the demo only when it alone is switched on. */
export async function getPalladiumClientConfig(): Promise<PalladiumClientConfig> {
  const wallet = getWalletConfig();
  const live = await livePaymentEnabled();
  const mode: PalladiumClientConfig['mode'] = live || !demoEnabled() ? 'live' : 'demo';
  const saleContract = (await saleOffered()) ? saleContractAddress() : null;
  return { mode, wallet, paymentWallet: paymentWalletAddress(), checkoutEnabled: live, confirmations: requiredConfirmations(), sale: saleContract ? { contract: saleContract } : null };
}
