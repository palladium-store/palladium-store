'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/components/ui/api-client';
import { peso } from '@/lib/money';
import { explorerTxUrl, shortAddress } from '@/lib/chain-config';
import type { TokenPaymentView } from '@/lib/palladium/live-server';
import { LivePaymentModal, type LivePaymentJob } from './live-checkout';
import { useLiveWallet } from './live-wallet';

/**
 * The order page's $PALLADIUM payment box while the order is unpaid: the locked amount, "Pay now" (same wallet flow as
 * checkout), and live progress while the chain confirms a transaction. It polls the server, which reads the receipt itself.
 */
export function TokenPaymentBlock({ initial, token }: { initial: TokenPaymentView; token: string }) {
  const router = useRouter();
  const w = useLiveWallet();
  const [view, setView] = useState(initial);
  const [job, setJob] = useState<LivePaymentJob | null>(null);
  const url = `/api/orders/${encodeURIComponent(view.orderNumber)}/palladium-pay`;
  const inFlight = !!view.txHash && (view.state === 'PENDING' || view.state === 'CONFIRMING');

  useEffect(() => {
    if (!inFlight || job) return;
    let live = true;
    const t = setInterval(async () => {
      try { const v = await api<TokenPaymentView>(`${url}?t=${encodeURIComponent(token)}`); if (!live) return; setView(v); if (v.state === 'PAID') router.refresh(); } catch { /* keep polling */ }
    }, 4000);
    return () => { live = false; clearInterval(t); };
  }, [inFlight, job, url, token, router]);

  const kv = (k: string, v: React.ReactNode) => <div><dt className="text-xs uppercase tracking-wider text-mute">{k}</dt><dd className="font-display text-2xl tracking-tightest tabular-nums">{v}</dd></div>;
  const txLink = view.txHash ? <a className="font-mono text-sm underline underline-offset-4" href={explorerTxUrl(w.config.wallet.chain, view.txHash)} target="_blank" rel="noopener noreferrer">{view.txHash.slice(0, 10)}...{view.txHash.slice(-6)}</a> : null;

  if (view.state === 'PAID') {
    return <p className="mt-2 text-sm">Payment confirmed. Refreshing your order...</p>;
  }

  return (
    <div>
      {inFlight ? (<>
        <p className="mt-2 text-sm">Your transfer was sent. {w.config.wallet.chain.name} is confirming it{view.confirmations ? ` (${view.confirmations.have} of ${view.confirmations.need} confirmations)` : ''}. This page updates by itself, and we email you when the payment is confirmed.</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {kv('Amount', `${view.tokenAmountDisplay} ${view.symbol}`)}
          <div><dt className="text-xs uppercase tracking-wider text-mute">Transaction</dt><dd className="pt-2">{txLink}</dd></div>
        </dl>
      </>) : view.state === 'REVIEW' ? (<>
        <p className="mt-2 text-sm">{view.note ?? 'Your payment arrived and needs a manual check. Palladium will contact you.'}</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {kv('Received', `${view.receivedDisplay ?? '-'} ${view.symbol}`)}
          <div><dt className="text-xs uppercase tracking-wider text-mute">Transaction</dt><dd className="pt-2">{txLink}</dd></div>
        </dl>
      </>) : (<>
        <p className="mt-2 text-sm">
          {view.note ? <>{view.note} </> : null}
          Pay {view.tokenAmountDisplay} {view.symbol} from your wallet on {w.config.wallet.chain.name}. {view.expired ? 'The locked amount has expired; it is re-locked at the current price when you continue.' : 'This amount is locked until ' + new Date(view.expiresAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) + '.'}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {kv('Amount to pay', `${view.tokenAmountDisplay} ${view.symbol}`)}
          {kv('Peso value', peso(view.totalCentavos))}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => setJob({ orderNumber: view.orderNumber, token })}>Pay with {view.symbol}</button>
          {w.address && <span className="text-xs text-mute">Wallet <span className="font-mono">{shortAddress(w.address)}</span>{!w.onChain && <span className="text-red-600"> (wrong network)</span>}</span>}
        </div>
        <p className="mt-3 text-xs text-mute">Your order is held for 3 hours from when it was placed. Network fees are paid in ETH on {w.config.wallet.chain.name}.</p>
      </>)}
      <LivePaymentModal
        job={job}
        onClose={() => { setJob(null); api<TokenPaymentView>(`${url}?t=${encodeURIComponent(token)}`).then(setView).catch(() => {}); }}
        onDone={() => { setJob(null); router.refresh(); }}
      />
    </div>
  );
}
