'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { balanceOfData, explorerAddressUrl, formatUnits, shortAddress, toHexChainId, transferData, type PalladiumClientConfig } from '@/lib/chain-config';

/**
 * The real wallet connection, over the standard EIP-1193 provider that MetaMask and every other injected EVM wallet expose.
 * Connecting shares the public address only. Nothing here ever asks for a seed phrase or private key, and the only thing
 * the store ever asks a wallet to sign is the ERC-20 transfer the customer chose to make at checkout. Whether that transfer
 * paid for an order is decided by the server from the blockchain receipt, never by this code.
 */
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, fn: (...args: unknown[]) => void): void;
  removeListener?(event: string, fn: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}
const provider = (): Eip1193 | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum);

/** Set when the customer disconnected, so a page load does not silently reconnect a wallet they asked us to forget. */
const FLAG = 'pal-wallet-off';
const setFlag = (on: boolean) => { try { if (on) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch { /* storage unavailable */ } };
const flagged = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };

export class WalletRejectedError extends Error { constructor() { super('You declined the request in your wallet.'); } }

export function walletMessage(e: unknown): string {
  const code = (e as { code?: number })?.code;
  const text = String((e as { message?: string })?.message ?? '').toLowerCase();
  if (code === 4001 || e instanceof WalletRejectedError || text.includes('user rejected') || text.includes('user denied')) return 'You declined the request in your wallet.';
  if (code === -32002) return 'A request is already waiting in your wallet. Open your wallet to continue.';
  if (code === 4100) return 'Your wallet has not authorized this site. Connect it again.';
  if (text.includes('insufficient funds')) return 'Your wallet does not have enough ETH on Robinhood Chain to pay the network fee.';
  if (text.includes('transfer amount exceeds balance') || text.includes('insufficient balance')) return 'Your wallet does not hold enough $PALLADIUM for this payment.';
  return 'Your wallet could not complete the request. Please try again.';
}

export interface LiveWallet {
  config: PalladiumClientConfig;
  ready: boolean;
  hasWallet: boolean;
  isMetaMask: boolean;
  address: string | null;
  chainId: number | null;
  /** Connected and on the configured chain. */
  onChain: boolean;
  /** $PALLADIUM balance in smallest units; null while unknown or without a contract. */
  balance: bigint | null;
  busy: boolean;
  error: string | null;
  deepLink: string | null;
  connect(): Promise<string | null>;
  disconnect(): Promise<void>;
  /** Switches the wallet to the configured chain (adding it first when the wallet does not know it). True when it ends up on the chain. */
  switchNetwork(): Promise<boolean>;
  refreshBalance(): Promise<void>;
  /** Asks the wallet to send an ERC-20 transfer of `amount` (smallest units) to `to`. Resolves with the transaction hash. */
  sendTransfer(to: string, amount: bigint): Promise<string>;
  clearError(): void;
  openConnect(): void;
  openAccount(): void;
}

const Ctx = createContext<LiveWallet | null>(null);
export function useLiveWallet(): LiveWallet {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLiveWallet must be used inside <LiveWalletProvider>');
  return c;
}

export function LiveWalletProvider({ config, children }: { config: PalladiumClientConfig; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const onChain = !!address && chainId === config.wallet.chain.chainId;
  const addressRef = useRef(address); addressRef.current = address;

  const readChain = useCallback(async (p: Eip1193) => { setChainId(parseInt(String(await p.request({ method: 'eth_chainId' })), 16)); }, []);

  useEffect(() => {
    const p = provider();
    setHasWallet(!!p); setIsMetaMask(!!p?.isMetaMask);
    setDeepLink(`https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`);
    if (!p) { setReady(true); return; }
    const onAccounts = (a: unknown) => { const list = a as string[]; const next = list?.[0] ?? null; setAddress(next); if (!next) setBalance(null); };
    const onChainChanged = (id: unknown) => setChainId(parseInt(String(id), 16));
    p.on?.('accountsChanged', onAccounts);
    p.on?.('chainChanged', onChainChanged);
    (async () => {
      try {
        if (!flagged()) { const a = (await p.request({ method: 'eth_accounts' })) as string[]; setAddress(a?.[0] ?? null); }
        await readChain(p);
      } catch { /* wallet locked or unavailable */ }
      setReady(true);
    })();
    return () => { p.removeListener?.('accountsChanged', onAccounts); p.removeListener?.('chainChanged', onChainChanged); };
  }, [readChain]);

  const refreshBalance = useCallback(async () => {
    const p = provider();
    const contract = config.wallet.contract;
    if (!p || !addressRef.current || !contract) { setBalance(null); return; }
    try {
      const r = await p.request({ method: 'eth_call', params: [{ to: contract, data: balanceOfData(addressRef.current) }, 'latest'] });
      setBalance(BigInt(String(r)));
    } catch { setBalance(null); }
  }, [config.wallet.contract]);

  useEffect(() => {
    setBalance(null);
    if (!address || !onChain || !config.wallet.contract) return;
    let live = true;
    void refreshBalance().then(() => { if (!live) setBalance(null); });
    return () => { live = false; };
  }, [address, onChain, config.wallet.contract, refreshBalance]);

  const connect = useCallback(async () => {
    const p = provider();
    if (!p) return null;
    setBusy(true); setError(null);
    try {
      const a = (await p.request({ method: 'eth_requestAccounts' })) as string[];
      const next = a?.[0] ?? null;
      setFlag(false); setAddress(next); await readChain(p);
      return next;
    } catch (e) { setError(walletMessage(e)); return null; }
    finally { setBusy(false); }
  }, [readChain]);

  const disconnect = useCallback(async () => {
    const p = provider();
    setFlag(true); setAddress(null); setBalance(null); setError(null); setAccountOpen(false);
    try { await p?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch { /* not supported by every wallet */ }
  }, []);

  const switchNetwork = useCallback(async () => {
    const p = provider();
    if (!p) return false;
    setBusy(true); setError(null);
    const c = config.wallet.chain;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHexChainId(c.chainId) }] });
    } catch (e) {
      if ((e as { code?: number })?.code === 4902 || /unrecognized chain|not added/i.test(String((e as Error)?.message))) {
        try {
          await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: toHexChainId(c.chainId), chainName: c.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [c.rpcUrl], blockExplorerUrls: [c.explorerUrl] }] });
        } catch (e2) { setError(walletMessage(e2)); }
      } else setError(walletMessage(e));
    }
    let id: number | null = null;
    try { const raw = await p.request({ method: 'eth_chainId' }); id = parseInt(String(raw), 16); setChainId(id); } catch { /* ignore */ }
    setBusy(false);
    return id === c.chainId;
  }, [config.wallet.chain]);

  const sendTransfer = useCallback(async (to: string, amount: bigint) => {
    const p = provider();
    if (!p) throw new Error('No wallet found.');
    const from = addressRef.current;
    if (!from) throw new Error('Connect your wallet first.');
    if (!config.wallet.contract) throw new Error('The token contract is not configured.');
    try {
      const hash = await p.request({ method: 'eth_sendTransaction', params: [{ from, to: config.wallet.contract, data: transferData(to, amount), value: '0x0' }] });
      return String(hash);
    } catch (e) {
      if ((e as { code?: number })?.code === 4001) throw new WalletRejectedError();
      throw new Error(walletMessage(e));
    }
  }, [config.wallet.contract]);

  const value = useMemo<LiveWallet>(() => ({
    config, ready, hasWallet, isMetaMask, address, chainId, onChain, balance, busy, error, deepLink,
    connect, disconnect, switchNetwork, refreshBalance, sendTransfer, clearError: () => setError(null),
    openConnect: () => setConnectOpen(true), openAccount: () => setAccountOpen(true),
  }), [config, ready, hasWallet, isMetaMask, address, chainId, onChain, balance, busy, error, deepLink, connect, disconnect, switchNetwork, refreshBalance, sendTransfer]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
    </Ctx.Provider>
  );
}

/** One line on what a connected wallet can do today, so nobody expects a payment option that is not switched on yet. */
export function WalletPurposeNote({ className = '' }: { className?: string }) {
  const { config } = useLiveWallet();
  return (
    <p className={className}>
      {config.checkoutEnabled
        ? <>You can pay with {config.wallet.symbol} at checkout. Prices stay in pesos; the token amount is locked when you place an order.</>
        : <>Paying with {config.wallet.symbol} opens when the token launches. Until then you can shop and pay in pesos as usual.</>}
    </p>
  );
}

function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useLiveWallet();
  const pick = async () => { const a = await w.connect(); if (a) onClose(); };
  const opt = 'flex w-full items-center justify-between border border-line px-4 py-4 text-left transition hover:border-ink disabled:opacity-60';
  return (
    <Modal open={open} onClose={() => !w.busy && onClose()} title="Connect wallet">
      {!w.ready ? <p className="py-6 text-center text-sm text-mute">Looking for a wallet...</p> : w.hasWallet ? (<>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Choose wallet</p>
        <button type="button" className={opt} disabled={w.busy} onClick={pick} aria-busy={w.busy}>
          <span><span className="block text-sm font-semibold">{w.isMetaMask ? 'MetaMask' : 'Browser wallet'}</span><span className="block text-xs text-mute">On {w.config.wallet.chain.name}</span></span>
          <span className="text-xs text-mute">{w.busy ? 'Check your wallet...' : 'Connect'}</span>
        </button>
        {w.error && <p className="mt-3 text-sm text-red-600" role="alert">{w.error}</p>}
      </>) : (<>
        <p className="text-sm text-mute">No browser wallet found. On a computer, install MetaMask or another EVM wallet and reload this page. On a phone, open this page inside your wallet app.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {w.deepLink && <a href={w.deepLink} className="btn-primary btn-sm">Open in MetaMask app</a>}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Get MetaMask</a>
        </div>
      </>)}
      <WalletPurposeNote className="mt-5 text-xs text-mute" />
      <p className="mt-2 text-[11px] text-mute">Connecting only shares your public address. Palladium never asks for a seed phrase or private key.</p>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-0"><dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mute">{k}</dt><dd className="min-w-0 text-right text-sm font-semibold tabular-nums">{v}</dd></div>;
}

function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useLiveWallet();
  const [copied, setCopied] = useState(false);
  const chain = w.config.wallet.chain;
  const copy = async () => { if (!w.address) return; try { await navigator.clipboard.writeText(w.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } };
  return (
    <Modal open={open && !!w.address} onClose={onClose} title="Wallet">
      {w.address && (<>
        <dl>
          <Row k="Address" v={<button type="button" onClick={copy} title={w.address} className="max-w-full truncate font-mono hover:underline">{copied ? 'Copied' : shortAddress(w.address)}</button>} />
          <Row k="Network" v={w.onChain ? chain.name : <span className="text-red-600">Wrong network{w.chainId ? ` (chain ${w.chainId})` : ''}</span>} />
          <Row k={w.config.wallet.symbol} v={!w.config.wallet.contract ? <span className="font-normal text-mute">Token deployment pending</span> : !w.onChain ? <span className="font-normal text-mute">Switch network to see it</span> : w.balance == null ? <span className="font-normal text-mute">Loading...</span> : formatUnits(w.balance, w.config.wallet.decimals)} />
        </dl>
        {w.error && <p className="mt-3 text-sm text-red-600" role="alert">{w.error}</p>}
        <WalletPurposeNote className="mt-4 text-xs text-mute" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <a href={explorerAddressUrl(chain, w.address)} target="_blank" rel="noopener noreferrer" className="text-xs text-mute underline underline-offset-4 hover:text-ink">View on explorer</a>
          <div className="flex gap-2">
            {!w.onChain && <button type="button" className="btn-primary btn-sm" onClick={() => void w.switchNetwork()} disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : `Switch to ${chain.name}`}</button>}
            <button type="button" className="btn-outline btn-sm" onClick={() => void w.disconnect()}>Disconnect</button>
          </div>
        </div>
      </>)}
    </Modal>
  );
}

const walletIcon = <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7a2 2 0 0 1 2-2h12v4" /><path d="M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2z" /><circle cx="16" cy="14" r="1" /></svg>;

/** Header control: "Connect wallet", or the connected address with its network and balance. */
export function LiveWalletButton() {
  const w = useLiveWallet();
  if (!w.ready || !w.address) {
    return (
      <button type="button" onClick={w.openConnect} aria-label="Connect wallet" className="relative mr-1 flex h-10 items-center gap-2 px-2 text-ink transition hover:text-gold-deep">
        {walletIcon}
        <span className="nav-label hidden text-xs font-semibold uppercase tracking-[0.14em] xl:inline">Connect wallet</span>
      </button>
    );
  }
  const sub = !w.onChain ? <span className="text-red-600">Wrong network</span>
    : !w.config.wallet.contract ? w.config.wallet.chain.name
    : w.balance == null ? w.config.wallet.chain.name
    : <><b className="text-gold-deep">{formatUnits(w.balance, w.config.wallet.decimals)}</b> {w.config.wallet.symbol}</>;
  return (
    <button type="button" onClick={w.openAccount} aria-label={`Wallet ${shortAddress(w.address)}, ${w.onChain ? w.config.wallet.chain.name : 'wrong network'}`}
      className="mr-1 flex h-10 items-center gap-2 border border-line px-2.5 text-left transition hover:border-ink">
      <span className="lg:hidden">{walletIcon}</span>
      <span className="hidden leading-tight lg:block">
        <span className="block font-mono text-[11px] font-semibold">{shortAddress(w.address)}</span>
        <span className="block text-[10px] text-mute tabular-nums">{sub}</span>
      </span>
      {!w.onChain && <span className="h-2 w-2 rounded-full bg-red-500 lg:hidden" aria-hidden="true" />}
    </button>
  );
}
