'use client';
import { formatUnits, shortAddress } from '@/lib/chain-config';
import { WalletPurposeNote, useLiveWallet } from './palladium/live-wallet';

/**
 * Wallet card for the token page and the account's Wallet page. It shows the same connection the header uses
 * (see palladium/live-wallet.tsx): connect, network check, $PALLADIUM balance, disconnect.
 */
export function WalletPanel({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const w = useLiveWallet();
  const { chain, contract, decimals, symbol } = w.config.wallet;
  const muted = dark ? 'text-white/60' : 'text-mute';
  const box = compact ? '' : `border p-5 ${dark ? 'border-white/15' : 'border-line'}`;
  const btn = dark ? 'btn-gold' : 'btn-primary';
  const ghost = dark ? 'btn border border-white/40 text-white hover:bg-white hover:text-night' : 'btn-outline';

  if (!w.ready) return <div className={box}><button type="button" className={btn} disabled>Connect wallet</button></div>;

  if (!w.hasWallet) {
    return (
      <div className={box}>
        <p className={`text-sm ${muted}`}>No browser wallet found. On a computer, install MetaMask or another EVM wallet. On a phone, open this page inside your wallet app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {w.deepLink && <a href={w.deepLink} className={btn}>Open in MetaMask app</a>}
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className={ghost}>Get MetaMask</a>
        </div>
      </div>
    );
  }

  if (!w.address) {
    return (
      <div className={box}>
        <button type="button" className={btn} onClick={() => void w.connect()} aria-busy={w.busy} disabled={w.busy}>{w.busy ? 'Check your wallet...' : 'Connect wallet'}</button>
        {w.error && <p className="mt-2 text-sm text-red-500" role="alert">{w.error}</p>}
        {!compact && <p className={`mt-3 text-xs ${muted}`}>Connecting only shares your public address. Palladium will never ask for your seed phrase or private key.</p>}
      </div>
    );
  }

  return (
    <div className={box} aria-live="polite">
      <dl className="grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Wallet</dt>
        <dd className="font-mono" title={w.address}>{shortAddress(w.address)}</dd>
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Network</dt>
        <dd>{w.onChain ? chain.name : <span className="text-red-500">Wrong network{w.chainId ? ` (chain ${w.chainId})` : ''}</span>}</dd>
        <dt className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>{symbol}</dt>
        <dd>{!contract ? <span className={muted}>Token deployment pending</span> : !w.onChain ? <span className={muted}>Switch network to see your balance</span> : w.balance == null ? <span className={muted}>Loading...</span> : formatUnits(w.balance, decimals)}</dd>
      </dl>
      {w.error && <p className="mt-3 text-sm text-red-500" role="alert">{w.error}</p>}
      {!compact && <WalletPurposeNote className={`mt-3 text-xs ${muted}`} />}
      <div className="mt-4 flex flex-wrap gap-2">
        {!w.onChain && <button type="button" className={btn} onClick={() => void w.switchNetwork()} aria-busy={w.busy} disabled={w.busy}>{w.busy ? 'Check your wallet...' : `Switch to ${chain.name}`}</button>}
        <button type="button" className={ghost} onClick={() => void w.disconnect()}>Disconnect</button>
      </div>
    </div>
  );
}
