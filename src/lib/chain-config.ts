/**
 * Robinhood Chain network presets and decimal-safe helpers. Safe to import from client and server code.
 * Values from docs.robinhood.com/chain/connecting (checked 1 Oct 2026). Public RPCs are rate-limited:
 * they are used only for wallets' "add network" prompt, never for server-side payment verification.
 */
export interface ChainPreset { chainId: number; name: string; rpcUrl: string; explorerUrl: string; testnet: boolean }

export const CHAINS: Record<'mainnet' | 'testnet', ChainPreset> = {
  mainnet: { chainId: 4663, name: 'Robinhood Chain', rpcUrl: 'https://rpc.mainnet.chain.robinhood.com', explorerUrl: 'https://robinhoodchain.blockscout.com', testnet: false },
  testnet: { chainId: 46630, name: 'Robinhood Chain Testnet', rpcUrl: 'https://rpc.testnet.chain.robinhood.com', explorerUrl: 'https://explorer.testnet.chain.robinhood.com', testnet: true },
};

/** What the browser wallet needs. Contains no secrets. */
export interface WalletConfig { chain: ChainPreset; contract: string | null; decimals: number; symbol: string }

export const toHexChainId = (id: number) => `0x${id.toString(16)}`;
export const isAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);
export const shortAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

/** Formats an integer token amount (smallest units) without floating point. Truncates, never rounds up. */
export function formatUnits(value: bigint, decimals: number, maxFraction = 4): string {
  const neg = value < 0n;
  const v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, '0').slice(0, maxFraction).replace(/0+$/, '');
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${wholeStr}${frac ? `.${frac}` : ''}`;
}

/** ABI-encoded call data for ERC-20 balanceOf(address). */
export function balanceOfData(owner: string): string {
  return `0x70a08231${owner.slice(2).toLowerCase().padStart(64, '0')}`;
}
