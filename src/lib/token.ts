import 'server-only';
import { CHAINS, isAddress, type WalletConfig } from './chain-config';

/**
 * Public token facts for the information pages. Everything comes from environment variables, so nothing is ever invented:
 * with no TOKEN_CONTRACT_ADDRESS set, the site says "Token deployment pending".
 * Prices are intentionally absent here; src/lib/pricing.ts is the only source of prices.
 */
export const TOKEN_NAME = 'Palladium';
export const TOKEN_SYMBOL = '$PALLADIUM';
/** Proposed fixed supply (whole tokens). Treated as proposed until the contract is deployed and verified. */
export const PROPOSED_MAX_SUPPLY = 1_000_000_000;

export interface TokenInfo {
  deployed: boolean;
  name: string;
  symbol: string;
  network: string;
  contractAddress: string | null;
  explorerUrl: string | null;
  maxSupply: number;
  circulatingSupply: string | null;
}

/**
 * The official $PALLADIUM contract on Robinhood Chain mainnet. Checked on-chain on 9 Oct 2026: name "Palladium", symbol
 * "PALLADIUM", 18 decimals, total supply exactly 1,000,000,000; no owner, no mint, no pause, not an upgradeable proxy.
 */
export const OFFICIAL_MAINNET_CONTRACT = '0xa6620f098b7d916e5279cdfde9261efe14d4aa8b';

/** Mainnet (where the token lives) unless TOKEN_NETWORK=testnet is set for testing. */
export const activeChain = () => ((process.env.TOKEN_NETWORK ?? '').trim().toLowerCase() === 'testnet' ? CHAINS.testnet : CHAINS.mainnet);
/** TOKEN_CONTRACT_ADDRESS when set; otherwise the official contract on mainnet (testnet has no default). */
const contract = () => {
  const raw = (process.env.TOKEN_CONTRACT_ADDRESS ?? '').trim();
  if (isAddress(raw)) return raw;
  return activeChain().testnet ? null : OFFICIAL_MAINNET_CONTRACT;
};

export function getWalletConfig(): WalletConfig {
  const d = Number(process.env.TOKEN_DECIMALS ?? 18);
  return { chain: activeChain(), contract: contract(), decimals: Number.isInteger(d) && d >= 0 && d <= 36 ? d : 18, symbol: TOKEN_SYMBOL };
}

export function getTokenInfo(): TokenInfo {
  const contractAddress = contract();
  const chain = activeChain();
  const explorer = (process.env.TOKEN_EXPLORER_URL ?? '').trim() || (contractAddress ? `${chain.explorerUrl}/token/${contractAddress}` : '');
  const circ = (process.env.TOKEN_CIRCULATING_SUPPLY_VERIFIED ?? '').trim();
  return {
    deployed: !!contractAddress,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    network: chain.name,
    contractAddress,
    explorerUrl: contractAddress && /^https:\/\//.test(explorer) ? explorer : null,
    maxSupply: PROPOSED_MAX_SUPPLY,
    circulatingSupply: /^\d+$/.test(circ) ? Number(circ).toLocaleString('en-PH') : null,
  };
}
