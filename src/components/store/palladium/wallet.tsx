'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { getPalladiumPaymentService } from '@/lib/palladium/payment-service';
import type { PalladiumPaymentService, PalladiumTx, WalletKind, WalletSession } from '@/lib/palladium/types';
import { formatPalladiumMinor } from '@/lib/palladium-price';
import { peso } from '@/lib/money';
import { DEMO_NETWORK_LABEL, DEMO_START_ETH, DEMO_START_PALLADIUM } from '@/lib/palladium/config';

/**
 * DEMO wallet UI. Everything here talks to a PalladiumPaymentService (see lib/palladium/types.ts); the demo implementation is
 * simulated, so no real wallet is opened and no cryptocurrency moves. Swap the service for the real one and this UI stays.
 */
interface Ctx {
  enabled: boolean;
  ready: boolean;
  service: PalladiumPaymentService;
  session: WalletSession;
  history: PalladiumTx[];
  openConnect: () => void;
  /** Teaser mode (demo off): shows the "in progress" modal instead of a wallet. */
  openSoon: () => void;
  openAccount: () => void;
  openTx: (tx: PalladiumTx) => void;
  disconnect: () => void;
}
const WalletCtx = createContext<Ctx | null>(null);

export function usePalladiumWallet(): Ctx {
  const c = useContext(WalletCtx);
  if (!c) throw new Error('usePalladiumWallet must be used inside <PalladiumWalletProvider>');
  return c;
}

export const DemoTag = ({ className = '' }: { className?: string }) => (
  <span className={`inline-block border border-gold px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-[0.16em] text-gold-deep ${className}`}>Demo</span>
);

const eth = (n: number) => n.toFixed(2);
/** Same on server and first client render (no localStorage yet), so hydration matches. The real state is read after mount. */
const INITIAL: WalletSession = { connected: false, walletType: null, address: null, palladiumMinor: DEMO_START_PALLADIUM * 100, eth: DEMO_START_ETH, network: DEMO_NETWORK_LABEL, mode: 'demo' };

export function PalladiumWalletProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const service = useMemo(() => getPalladiumPaymentService(), []);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<WalletSession>(INITIAL);
  const [history, setHistory] = useState<PalladiumTx[]>([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [txOpen, setTxOpen] = useState<PalladiumTx | null>(null);
  const [soonOpen, setSoonOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => { setSession({ ...service.getSession() }); setHistory([...service.getHistory()]); };
    sync(); setReady(true);
    return service.subscribe(sync);
  }, [enabled, service]);

  const value: Ctx = useMemo(() => ({
    enabled, ready, service, session, history,
    openConnect: () => setConnectOpen(true),
    openSoon: () => setSoonOpen(true),
    openAccount: () => setAccountOpen(true),
    openTx: (tx) => setTxOpen(tx),
    disconnect: () => { service.disconnect(); setAccountOpen(false); },
  }), [enabled, ready, service, session, history]);

  return (
    <WalletCtx.Provider value={value}>
      {children}
      {!enabled && <SoonModal open={soonOpen} onClose={() => setSoonOpen(false)} />}
      {enabled && <>
        <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
        <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
        <TxModal tx={txOpen} onClose={() => setTxOpen(null)} />
      </>}
    </WalletCtx.Provider>
  );
}

/** Teaser shown while $PALLADIUM payments are not live. No wallet is opened and nothing is connected. */
function SoonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Pay with crypto">
      <div className="py-4 text-center">
        <span className="inline-block border border-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gold-deep">In progress</span>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">$PALLADIUM payments are coming soon</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mute">We are building wallet checkout so you can pay with $PALLADIUM. Stay tuned. In the meantime, you can pay with QR Ph.</p>
        <button type="button" onClick={onClose} className="btn-primary btn-sm mt-6">Got it</button>
      </div>
    </Modal>
  );
}

const DemoBanner = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4 flex items-start gap-2 border border-gold bg-gold-soft px-3 py-2 text-xs text-ink">
    <DemoTag className="mt-px shrink-0" />
    <span>{children}</span>
  </div>
);

function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { service } = usePalladiumWallet();
  const [busy, setBusy] = useState<WalletKind | null>(null);
  const pick = useCallback(async (kind: WalletKind) => {
    setBusy(kind);
    try { await service.connect(kind); onClose(); } finally { setBusy(null); }
  }, [service, onClose]);
  const opt = 'flex w-full items-center justify-between border border-line px-4 py-4 text-left transition hover:border-ink disabled:opacity-60';
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Connect wallet">
      <DemoBanner><b>DEMO MODE.</b> This is a simulated wallet. Your real MetaMask is not opened, nothing is signed and no cryptocurrency is used.</DemoBanner>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Choose wallet</p>
      <div className="space-y-2">
        <button type="button" className={opt} disabled={!!busy} onClick={() => pick('metamask')} aria-busy={busy === 'metamask'}>
          <span><span className="block text-sm font-semibold">MetaMask</span><span className="block text-xs text-mute">Simulated in demo mode</span></span>
          <span className="text-xs text-mute">{busy === 'metamask' ? 'Connecting...' : <DemoTag />}</span>
        </button>
        <button type="button" className={opt} disabled={!!busy} onClick={() => pick('demo')} aria-busy={busy === 'demo'}>
          <span><span className="block text-sm font-semibold">Demo Wallet</span><span className="block text-xs text-mute">10,000 PALLADIUM and 0.50 ETH to test with</span></span>
          <span className="text-xs text-mute">{busy === 'demo' ? 'Connecting...' : <DemoTag />}</span>
        </button>
      </div>
      <p className="mt-4 text-[11px] text-mute">We never ask for a seed phrase or private key.</p>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0"><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">{k}</dt><dd className="text-right text-sm font-semibold tabular-nums">{v}</dd></div>;
}

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, history, disconnect, openTx, service } = usePalladiumWallet();
  return (
    <Modal open={open && session.connected} onClose={onClose} title="Wallet">
      <DemoBanner><b>DEMO MODE.</b> Simulated wallet. These balances are not real cryptocurrency.</DemoBanner>
      <dl>
        <Row k="Wallet address" v={<span className="font-mono">{session.address}</span>} />
        <Row k="PALLADIUM balance" v={formatPalladiumMinor(session.palladiumMinor)} />
        <Row k="ETH balance" v={eth(session.eth)} />
        <Row k="Network" v={DEMO_NETWORK_LABEL} />
      </dl>
      <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Transaction history <DemoTag className="ml-1" /></h3>
      {history.length === 0 ? <p className="border border-dashed border-line px-4 py-6 text-center text-sm text-mute">No demo payments yet.</p> : (
        <ul className="max-h-64 divide-y divide-line overflow-y-auto border border-line">
          {history.map((t) => (
            <li key={t.txId}>
              <button type="button" onClick={() => openTx(t)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-bone">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em]">PALLADIUM payment <DemoTag className="ml-1 align-middle" /></span>
                  <span className="mt-0.5 block truncate text-sm">{t.label}</span>
                  <span className="block text-xs text-mute">Order #{t.orderNumber} &middot; {t.status}</span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">-{formatPalladiumMinor(t.amountMinor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button type="button" className="text-xs text-mute underline underline-offset-4 hover:text-ink" onClick={() => service.resetDemo?.()}>Reset demo wallet</button>
        <button type="button" className="btn-outline btn-sm" onClick={disconnect}>Disconnect</button>
      </div>
    </Modal>
  );
}

export function TxModal({ tx, onClose }: { tx: PalladiumTx | null; onClose: () => void }) {
  return (
    <Modal open={!!tx} onClose={onClose} title="Demo transaction">
      {tx && (<>
        <DemoBanner><b>DEMO TRANSACTION.</b> This was simulated. No real cryptocurrency was transferred and nothing was recorded on a blockchain.</DemoBanner>
        <dl>
          <Row k="Transaction" v={<span className="font-mono">{tx.txId}</span>} />
          <Row k="Status" v={tx.status} />
          <Row k="Paid" v={`${formatPalladiumMinor(tx.amountMinor)} PALLADIUM`} />
          <Row k="PHP value" v={peso(tx.phpCentavos)} />
          <Row k="PALLADIUM price" v={`${peso(Math.round(tx.tokenPricePhp * 100))} (demo)`} />
          <Row k="Order" v={`#${tx.orderNumber}`} />
          <Row k="Wallet" v={<span className="font-mono">{tx.wallet}</span>} />
          <Row k="Network" v={tx.network} />
          <Row k="Time" v={new Date(tx.at).toLocaleString('en-PH')} />
        </dl>
      </>)}
    </Modal>
  );
}

/** Header control: "Connect wallet" or the connected address with balances. */
export function WalletButton() {
  const { enabled, ready, session, openConnect, openAccount, openSoon } = usePalladiumWallet();
  const icon = <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12v4" /><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z" /><circle cx="16" cy="14" r="1" /></svg>;
  if (!enabled) {
    return (
      <button type="button" onClick={openSoon} aria-label="Connect wallet (in progress)" className="relative mr-1 flex h-10 items-center gap-2 px-2 text-ink transition hover:text-gold-deep">
        {icon}
        <span className="nav-label hidden text-xs font-semibold uppercase tracking-[0.14em] xl:inline">Connect wallet</span>
        <span className="hidden border border-gold px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-[0.16em] text-gold-deep sm:inline-block">Soon</span>
      </button>
    );
  }
  if (!ready || !session.connected) {
    return (
      <button type="button" onClick={openConnect} aria-label="Connect wallet (demo)" className="relative mr-1 flex h-10 items-center gap-2 px-2 text-ink transition hover:text-gold-deep">
        {icon}
        <span className="hidden text-xs font-semibold uppercase tracking-[0.14em] xl:inline">Connect wallet</span>
        <DemoTag className="hidden sm:inline-block" />
      </button>
    );
  }
  return (
    <button type="button" onClick={openAccount} aria-label={`Wallet ${session.address}, ${formatPalladiumMinor(session.palladiumMinor)} PALLADIUM (demo)`}
      className="mr-1 flex h-10 items-center gap-2 border border-line px-2.5 text-left transition hover:border-ink">
      <span className="lg:hidden">{icon}</span>
      <span className="hidden leading-tight lg:block">
        <span className="block font-mono text-[11px] font-semibold">{session.address}</span>
        <span className="block text-[10px] text-mute tabular-nums"><b className="text-gold-deep">{formatPalladiumMinor(session.palladiumMinor)}</b> PALLADIUM &middot; {eth(session.eth)} ETH</span>
      </span>
      <DemoTag className="hidden sm:inline-block" />
    </button>
  );
}
