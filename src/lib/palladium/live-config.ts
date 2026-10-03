/**
 * PLACEHOLDERS for the future real payment. NOTHING reads these in demo mode and no fake production values are provided.
 * When the real token launches, set these environment variables and implement RobinhoodChainPalladiumPaymentService
 * (see payment-service.ts):
 *
 *   PALLADIUM_TOKEN_ADDRESS            ERC-20 contract address of $PALLADIUM on Robinhood Chain
 *   PALLADIUM_PAYMENT_WALLET_ADDRESS   Palladium's receiving wallet
 *   PALLADIUM_TOKEN_DECIMALS           token decimals (for example 18)
 *   ROBINHOOD_CHAIN_ID                 chain id (see src/lib/chain-config.ts for the published presets)
 */
export interface PalladiumLiveConfig { tokenAddress: string | null; paymentWallet: string | null; decimals: number | null; chainId: number | null }

/** Server only. Returns nulls until the real values are configured. Not used by the demo. */
export function getPalladiumLiveConfig(): PalladiumLiveConfig {
  const n = (v: string | undefined) => { const x = Number(v); return v && Number.isInteger(x) ? x : null; };
  return {
    tokenAddress: process.env.PALLADIUM_TOKEN_ADDRESS?.trim() || null,
    paymentWallet: process.env.PALLADIUM_PAYMENT_WALLET_ADDRESS?.trim() || null,
    decimals: n(process.env.PALLADIUM_TOKEN_DECIMALS),
    chainId: n(process.env.ROBINHOOD_CHAIN_ID),
  };
}
