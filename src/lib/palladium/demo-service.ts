import { DEMO_NETWORK_LABEL, DEMO_START_ETH, DEMO_START_PALLADIUM, DEMO_TX_PREFIX, DEMO_WALLET_ADDRESS } from './config';
import { getPalladiumPricePhp, phpToPalladiumMinor } from '@/lib/palladium-price';
import {
  InsufficientBalanceError, WalletNotConnectedError,
  type PalladiumPaymentService, type PalladiumTx, type PayQuote, type PayRequest, type PaymentReceipt, type WalletKind, type WalletSession,
} from './types';

/**
 * DEMO implementation. Simulated wallet and payment: no MetaMask, no token contract, no RPC, no signatures, no real cryptocurrency.
 * State lives in this browser's localStorage so it survives a refresh. Nothing here is a blockchain transaction.
 */
const KEY = 'pal-demo-wallet-v1';
const MAX_HISTORY = 25;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Stored { connected: boolean; walletType: WalletKind | null; palladiumMinor: number; eth: number; history: PalladiumTx[] }
const fresh = (): Stored => ({ connected: false, walletType: null, palladiumMinor: DEMO_START_PALLADIUM * 100, eth: DEMO_START_ETH, history: [] });

function validTx(t: unknown): t is PalladiumTx {
  const x = t as PalladiumTx;
  return !!x && typeof x.txId === 'string' && Number.isFinite(x.amountMinor) && typeof x.orderNumber === 'string';
}

function newTxId(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  return DEMO_TX_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export class DemoPalladiumPaymentService implements PalladiumPaymentService {
  readonly id = 'demo';
  readonly mode = 'demo' as const;
  private state: Stored = fresh();
  private listeners = new Set<() => void>();
  private loaded = false;

  private load() {
    if (this.loaded || typeof window === 'undefined') return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Stored>;
        const s = fresh();
        this.state = {
          connected: p.connected === true,
          walletType: p.walletType === 'metamask' || p.walletType === 'demo' ? p.walletType : null,
          palladiumMinor: Number.isInteger(p.palladiumMinor) && (p.palladiumMinor as number) >= 0 ? (p.palladiumMinor as number) : s.palladiumMinor,
          eth: typeof p.eth === 'number' && p.eth >= 0 ? p.eth : s.eth,
          history: Array.isArray(p.history) ? p.history.filter(validTx).slice(0, MAX_HISTORY) : [],
        };
        if (!this.state.connected) this.state.walletType = null;
      }
    } catch { this.state = fresh(); /* storage unavailable or corrupt: start clean, never break the page */ }
    window.addEventListener('storage', (e) => { if (e.key === KEY) { this.loaded = false; this.load(); this.emit(false); } });
  }

  private save() { try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* storage unavailable: demo state stays in memory */ } }
  private emit(persist = true) { if (persist) this.save(); this.listeners.forEach((fn) => fn()); }

  subscribe(fn: () => void) { this.load(); this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  getSession(): WalletSession {
    this.load();
    const s = this.state;
    return {
      connected: s.connected, walletType: s.connected ? s.walletType : null, address: s.connected ? DEMO_WALLET_ADDRESS : null,
      palladiumMinor: s.palladiumMinor, eth: s.eth, network: DEMO_NETWORK_LABEL, mode: 'demo',
    };
  }

  getHistory(): PalladiumTx[] { this.load(); return this.state.history; }

  async connect(kind: WalletKind): Promise<WalletSession> {
    this.load();
    await wait(700); // simulated handshake. The real MetaMask extension is NOT opened.
    this.state = { ...this.state, connected: true, walletType: kind };
    this.emit();
    return this.getSession();
  }

  disconnect() { this.load(); this.state = { ...this.state, connected: false, walletType: null }; this.emit(); }

  quote(phpCentavos: number): PayQuote { return { amountMinor: phpToPalladiumMinor(phpCentavos), tokenPricePhp: getPalladiumPricePhp() }; }

  canAfford(amountMinor: number) { this.load(); return this.state.palladiumMinor >= amountMinor; }

  async pay(req: PayRequest, onStep?: (i: number) => void): Promise<PaymentReceipt> {
    this.load();
    const q = this.quote(req.phpCentavos);

    onStep?.(0); await wait(650);
    if (!this.state.connected) throw new WalletNotConnectedError();

    onStep?.(1); await wait(750);
    if (this.state.palladiumMinor < q.amountMinor) throw new InsufficientBalanceError(q.amountMinor, this.state.palladiumMinor);

    onStep?.(2); await wait(800);
    const txId = newTxId();

    onStep?.(3);
    // The order is marked paid on the server here. If that fails it throws and nothing is deducted.
    await Promise.all([req.confirmOrder(txId, DEMO_WALLET_ADDRESS), wait(1100)]);

    // Re-check: another tab may have spent the balance in the meantime.
    this.load();
    if (this.state.palladiumMinor < q.amountMinor) throw new InsufficientBalanceError(q.amountMinor, this.state.palladiumMinor);
    const previousMinor = this.state.palladiumMinor;
    const newMinor = previousMinor - q.amountMinor;
    const tx: PalladiumTx = {
      txId, kind: 'PAYMENT', status: 'Confirmed', mode: 'DEMO', amountMinor: q.amountMinor, phpCentavos: req.phpCentavos, tokenPricePhp: q.tokenPricePhp,
      orderNumber: req.orderNumber, label: req.label, wallet: DEMO_WALLET_ADDRESS, network: DEMO_NETWORK_LABEL, at: new Date().toISOString(),
    };
    this.state = { ...this.state, palladiumMinor: newMinor, history: [tx, ...this.state.history].slice(0, MAX_HISTORY) };
    this.emit();

    onStep?.(4); await wait(450);
    return { tx, previousMinor, paidMinor: q.amountMinor, newMinor };
  }

  resetDemo() { this.load(); this.state = { ...this.state, palladiumMinor: DEMO_START_PALLADIUM * 100, eth: DEMO_START_ETH, history: [] }; this.emit(); }
}
