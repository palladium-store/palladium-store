/**
 * The ONLY seam between the UI and "the blockchain".
 * Everything in the shop, header and checkout talks to a PalladiumPaymentService and never to MetaMask, a contract or an RPC.
 *
 *   Today:  DemoPalladiumPaymentService               (simulated wallet + payment, localStorage, no network calls)
 *   Later:  RobinhoodChainPalladiumPaymentService     (MetaMask -> Robinhood Chain -> $PALLADIUM contract -> Palladium wallet,
 *                                                     then server-side blockchain verification before the order is marked paid)
 *
 * To go live: implement this interface with the real chain code and return it from getPalladiumPaymentService().
 * The UI components do not change.
 */
export type WalletKind = 'metamask' | 'demo';

export interface WalletSession {
  connected: boolean;
  walletType: WalletKind | null;
  /** Address as displayed (the demo uses the shortened form). */
  address: string | null;
  /** PALLADIUM balance in minor units (hundredths of a token). */
  palladiumMinor: number;
  /** Native balance shown next to it (ETH). */
  eth: number;
  network: string;
  mode: 'demo' | 'live';
}

export interface PalladiumTx {
  txId: string;
  kind: 'PAYMENT';
  status: 'Confirmed';
  mode: 'DEMO' | 'LIVE';
  amountMinor: number;
  phpCentavos: number;
  tokenPricePhp: number;
  orderNumber: string;
  label: string;
  wallet: string;
  network: string;
  at: string;
}

export interface PayRequest {
  orderNumber: string;
  phpCentavos: number;
  /** What was bought, shown in the history ("Palladium KORU"). */
  label: string;
  /**
   * Called while the payment is being confirmed. The caller marks the order paid on the server and throws if that fails,
   * in which case nothing is deducted. For real payments this is where the server verifies the transaction on-chain.
   */
  confirmOrder: (txId: string, wallet: string) => Promise<void>;
}

export interface PaymentReceipt {
  tx: PalladiumTx;
  previousMinor: number;
  paidMinor: number;
  newMinor: number;
}

export interface PayQuote { amountMinor: number; tokenPricePhp: number }

export const PAYMENT_STEPS = [
  'Checking wallet...',
  'Checking PALLADIUM balance...',
  'Preparing transaction...',
  'Confirming payment...',
  'Payment confirmed.',
] as const;

export class InsufficientBalanceError extends Error {
  constructor(public requiredMinor: number, public availableMinor: number) { super('INSUFFICIENT_PALLADIUM'); }
}
export class WalletNotConnectedError extends Error { constructor() { super('Connect your wallet first.'); } }

export interface PalladiumPaymentService {
  readonly id: string;
  readonly mode: 'demo' | 'live';
  getSession(): WalletSession;
  getHistory(): PalladiumTx[];
  /** Calls fn after any change (also from another tab). Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
  connect(kind: WalletKind): Promise<WalletSession>;
  disconnect(): void;
  quote(phpCentavos: number): PayQuote;
  canAfford(amountMinor: number): boolean;
  pay(req: PayRequest, onStep?: (stepIndex: number) => void): Promise<PaymentReceipt>;
  /** Demo only: puts the starting balance back so more purchases can be tested. */
  resetDemo?(): void;
}

