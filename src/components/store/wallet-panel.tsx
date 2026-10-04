'use client';
import { useCallback, useEffect, useState } from 'react';
import { balanceOfData, formatUnits, shortAddress, toHexChainId, type WalletConfig } from '@/lib/chain-config';

/**
 * Browser-wallet connection over the standard EIP-1193 provider (MetaMask and other injected EVM wallets).
 * Read-only: it never asks for a seed phrase or private key, never signs anything and never sends a transaction.
 */
interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, fn: (...args: unknown[]) => void): void;
  removeListener?(event: string, fn: (...args: unknown[]) => void): void;
}
const provider = (): Eip1193 | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { ethereum?: Eip1193 }).ethereum);
const FLAG = 'pal-wallet-off';
const setFlag = (on: boolean) => { try { if (on) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch { /* storage unavailable */ } };
const flagged = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return false; } };

function message(e: unknown): string {
  const code = (e as { code?: number })?.code;
  if (code === 4001) return 'You declined the request in your wallet.';
  if (code === -32002) return 'A request is already waiting in your wallet. Open your wallet to continue.';
  return 'Your wallet could not complete the request. Please try again.';
}

export function WalletPanel({ config, dark = false, compact = false }: { config: WalletConfig; dark?: boolean; compact?: boolean }) {
  const [ready, setReady] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const onChain = chainId === config.chain.chainId;

  const readChain = useCallback(async (p: Eip1193) => { setChainId(parseInt(String(await p.request({ method: 'eth_chainId' })), 16)); }, []);

  useEffect(() => {
    const p = provider();
    setHasWallet(!!p);
    setDeepLink(`https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`);
    if (!p) { setReady(true); return; }
    const onAccounts = (a: unknown) => { const list = a as string[]; setAddress(list?.[0] ?? null); };
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

  useEffect(() => {
    const p = provider();
    setBalance(null);
    if (!p || !address || !onChain || !config.contract) return;
    let live = true;
    p.request({ method: 'eth_call', params: [{ to: config.contract, data: balanceOfData(address) }, 'latest'] })
      .then((r) => { if (live) setBalance(formatUnits(BigInt(String(r)), config.decimals)); })
      .catch(() => { if (live) setBalance(null); });
    return () => { live = false; };
  }, [address, onChain, config.contract, config.decimals]);

  async function connect() {
    const p = provider();
    if (!p || busy) return;
    setBusy(true); setErr(null);
    try {
      const a = (await p.request({ method: 'eth_requestAccounts' })) as string[];
      setFlag(false); setAddress(a?.[0] ?? null); await readChain(p);
    } catch (e) { setErr(message(e)); }
    setBusy(false);
  }

  async function disconnect() {
    const p = provider();
    setFlag(true); setAddress(null); setBalance(null); setErr(null);
    try { await p?.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch { /* not supported by every wallet */ }
  }

  async function switchNetwork() {
    const p = provider();
    if (!p || busy) return;
    setBusy(true); setErr(null);
    const c = config.chain;
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toHexChainId(c.chainId) }] });
    } catch (e) {
      if ((e as { code?: number })?.code === 4902) {
        try {
          await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: toHexChainId(c.chainId), chainName: c.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [c.rpcUrl], blockExplorerUrls: [c.explorerUrl] }] });
        } catch (e2) { setErr(message(e2)); }
      } else setErr(message(e));
    }
    try { await readChain(p); } catch { /* ignore */ }
    setBusy(false);
  }

  const muted = dark ? 'text-white/60' : 'text-mute';
  const box = compact ? '' : `border p-5 ${dark ? 'border-white/15' : 'border-line'}`;
  const btn = dark ? 'btn-gold' : 'btn-primary';
  const ghost = dark ? 'btn border border-white/40 text-white hover:bg-white hover:text-night' : 'btn-outline';

  if (!ready) return <div className={box}><button type="button" className={btn} disabled>Connect wallet</button></div>;

  if (!hasWallet) {
    return (
      <div className={box}>
        <p className={`text-sm ${muted}`}>No browser wallet found. On a computer, install MetaMask or another EVM wallet. On a phone, open this page inside your wallet app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {deepLink && <a href={deepLink} className={btn}>Open in MetaMask app</a>}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className={ghost}>Get MetaMask</a>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className={box}>
        <button type="button" className={btn} onClick={connect} aria-busy={busy} disabled={busy}>{busy ? 'Check your wallet...' : 'Connect wallet'}</button>
        {err && <p className="mt-2 text-sm text-red-500" role="alert">{err}</p>}
        {!compact && <p className={`mt-3 text-xs ${muted}`}>Connecting only shares your public address. Palladium will never ask for your seed phrase or private key.</p>}
      </div>
    );
  }

  return (
    <div className={box} aria-live="polite">
      <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Wallet</dt>
        <dd className="font-mono" title={address}>{shortAddress(address)}</dd>
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Network</dt>
        <dd>{onChain ? config.chain.name : <span className="text-red-500">Wrong network{chainId ? ` (chain ${chainId})` : ''}</span>}</dd>
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>{config.symbol}</dt>
        <dd>{!config.contract ? <span className={muted}>Token deployment pending</span> : !onChain ? <span className={muted}>Switch network to see your balance</span> : balance ?? <span className={muted}>Loading...</span>}</dd>
      </dl>
      {err && <p className="mt-3 text-sm text-red-500" role="alert">{err}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!onChain && <button type="button" className={btn} onClick={switchNetwork} aria-busy={busy} disabled={busy}>{busy ? 'Check your wallet...' : `Switch to ${config.chain.name}`}</button>}
        <button type="button" className={ghost} onClick={disconnect}>Disconnect</button>
      </div>
    </div>
  );
}
