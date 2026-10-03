/**
 * $PALLADIUM DEMO configuration. Client and server safe. Nothing here is real: there is no token contract,
 * no real wallet and no blockchain call anywhere in demo mode.
 */
export { DEMO_PALLADIUM_PRICE_PHP } from '@/lib/palladium-price';

/** Shown for the simulated wallet. It is a label, not a real address. */
export const DEMO_WALLET_ADDRESS = '0x71C4...8A92';
/** Starting demo balances. */
export const DEMO_START_PALLADIUM = 10_000;
export const DEMO_START_ETH = 0.5;
export const DEMO_NETWORK_LABEL = 'Robinhood Chain — DEMO';
export const DEMO_TX_PREFIX = 'DEMO-TX-';
/** Demo transaction ids look like DEMO-TX-8F42A91C. */
export const DEMO_TX_PATTERN = /^DEMO-TX-[0-9A-F]{8}$/;
export const DEMO_WALLET_PATTERN = /^0x[0-9a-fA-F]{4}\.\.\.[0-9a-fA-F]{4}$/;
/** Order.paymentMode value written for demo payments. */
export const PAYMENT_MODE_DEMO = 'DEMO';
