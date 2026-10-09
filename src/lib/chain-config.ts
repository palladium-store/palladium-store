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
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Parses a typed token amount ("12", "0.5", "1,250.25") into smallest units without floating point. Returns null for anything
 * that is not a plain positive decimal or has more decimals than the token supports, so a typo never becomes a different amount.
 */
export function parseUnits(input: string, decimals: number): bigint | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d*(\.\d*)?$/.test(s) || s === '' || s === '.') return null;
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) return null;
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
}
/** The 32-byte log topic form of an address (for eth_getLogs filters). */
export const addressTopic = (a: string) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
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

// ---- ERC-20 transfer helpers (client and server safe) ----

/** keccak256("Transfer(address,address,uint256)"): the topic every ERC-20 transfer log carries. */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const isTxHash = (s: string) => /^0x[a-fA-F0-9]{64}$/.test(s);
export const sameAddress = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** ABI-encoded call data for ERC-20 transfer(address to, uint256 amount). */
export function transferData(to: string, amount: bigint): string {
  if (!isAddress(to)) throw new Error('Invalid recipient address');
  if (amount <= 0n) throw new Error('Amount must be positive');
  return `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`;
}

/** The last 20 bytes of a 32-byte log topic, as a lowercase address. */
export const topicToAddress = (topic: string) => `0x${topic.slice(-40).toLowerCase()}`;
export const hexToBigInt = (hex: string) => (hex && hex !== '0x' ? BigInt(hex) : 0n);

/** Explorer links for a transaction or address. */
export const explorerTxUrl = (chain: ChainPreset, hash: string) => `${chain.explorerUrl}/tx/${hash}`;
export const explorerAddressUrl = (chain: ChainPreset, address: string) => `${chain.explorerUrl}/address/${address}`;

/** What the browser needs to connect a wallet and pay. No secrets, safe to send to the client. */
export interface PalladiumClientConfig {
  /** demo: the simulated wallet (PALLADIUM_DEMO_MODE, never on production). live: a real wallet on the configured chain. */
  mode: 'demo' | 'live';
  wallet: WalletConfig;
  /** Palladium's receiving wallet; null until configured. */
  paymentWallet: string | null;
  /** Whether "Pay with $PALLADIUM" is offered at checkout (needs the contract, the receiving wallet and a reviewed price). */
  checkoutEnabled: boolean;
  /** Blocks that must follow a transaction before the store treats it as confirmed. */
  confirmations: number;
  /** The token sale contract, when buying is offered. */
  sale: { contract: string } | null;
}
