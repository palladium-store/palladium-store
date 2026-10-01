import 'server-only';
import { CHAINS, isAddress, type WalletConfig } from './chain-config';

/**
 * Public token facts for the information pages. Everything comes from environment variables, so nothing is ever invented:
 * with no TOKEN_CONTRACT_ADDRESS set, the site says "Token deployment pending".
 * Prices are intentionally absent here; the pricing engine (a later phase) is the only source of market prices.
 */
export const TOKEN_NAME = 'Palladium';
export const TOKEN_SYMBOL = '$PALLADIUM';
/** Proposed fixed supply (whole tokens). Treated as proposed until the contract is deployed and verified. */
export const PROPOSED_MAX_SUPPLY = 100_000_000;

/** Proposed allocation, in whole percent. Must add up to 100. Not final until approved. */
export const PROPOSED_ALLOCATION = [
  { key: 'community', label: 'Community and customer rewards', pct: 30, note: 'Funds rewards from a fixed pool. No new tokens are ever minted.' },
  { key: 'ecosystem', label: 'Ecosystem and merchant adoption', pct: 20, note: 'Retail partners, clubs and future Palladium Touchpoints.' },
  { key: 'treasury', label: 'Treasury reserve', pct: 20, note: 'Held under multisignature control with spending limits.' },
  { key: 'operations', label: 'Development and operations', pct: 15, note: 'Building and running the platform.' },
  { key: 'team', label: 'Founders and team', pct: 10, note: 'Subject to a vesting schedule.' },
  { key: 'liquidity', label: 'Liquidity', pct: 5, note: 'Subject to legal review before any use.' },
] as const;

export interface TokenInfo {
  deployed: boolean;
  name: string;
  symbol: string;
  network: string;
  contractAddress: string | null;
  explorerUrl: string | null;
  maxSupply: number;
  circulatingSupply: string | null;
  priceAvailable: false;
}

/** TOKEN_NETWORK=mainnet switches to mainnet; anything else (or unset) means testnet. */
export const activeChain = () => ((process.env.TOKEN_NETWORK ?? '').trim().toLowerCase() === 'mainnet' ? CHAINS.mainnet : CHAINS.testnet);
const contract = () => { const raw = (process.env.TOKEN_CONTRACT_ADDRESS ?? '').trim(); return isAddress(raw) ? raw : null; };

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
    priceAvailable: false,
  };
}
