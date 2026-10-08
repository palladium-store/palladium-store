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
  };
}
