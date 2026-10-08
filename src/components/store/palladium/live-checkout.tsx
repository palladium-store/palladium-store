'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { api, ApiError } from '@/components/ui/api-client';
import { peso } from '@/lib/money';
import { explorerTxUrl, formatUnits, shortAddress } from '@/lib/chain-config';
import { formatPrice, parsePrice, tokenAmountForPhp } from '@/lib/token-math';
import type { TokenPaymentView } from '@/lib/palladium/live-server';
import { WalletRejectedError, useLiveWallet } from './live-wallet';

/**
 * Real $PALLADIUM checkout. The panel shows an indicative amount from the published price; the binding amount is locked by
 * the server when the order is placed, and the payment modal pays exactly that. The server reads the blockchain receipt and
 * marks the order paid; this code only relays the transaction hash the wallet returned.
 */
interface PriceInfo { available: boolean; phpPerToken?: string; checkoutEnabled?: boolean }

/** Indicative token amount for a peso total, from the public price endpoint. */
export function useIndicativeAmount(totalCentavos: number | null) {
  const { config } = useLiveWallet();
  const [price, setPrice] = useState<PriceInfo | null>(null);
  useEffect(() => {
    let live = true;
    api<PriceInfo>('/api/token/price').then((p) => { if (live) setPrice(p); }).catch(() => { if (live) setPrice({ available: false }); });
    const t = setInterval(() => { api<PriceInfo>('/api/token/price').then((p) => { if (live) setPrice(p); }).catch(() => {}); }, 60_000);
    return () => { live = false; clearInterval(t); };
  }, []);
  if (!price?.available || !price.phpPerToken || totalCentavos == null || totalCentavos <= 0) return { amount: null as bigint | null, display: null as string | null, rate: price?.phpPerToken ?? null, loading: price == null };
  try {
    const amount = tokenAmountForPhp(totalCentavos, parsePrice(price.phpPerToken), config.wallet.decimals);
    return { amount, display: formatUnits(amount, config.wallet.decimals, 6), rate: formatPrice(parsePrice(price.phpPerToken), 4), loading: false };
  } catch { return { amount: null, display: null, rate: null, loading: false }; }
}

const row = 'flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm';

export function LivePayPanel({ totalCentavos }: { totalCentavos: number | null }) {
  const w = useLiveWallet();
  const ind = useIndicativeAmount(totalCentavos);
  const { symbol, chain, decimals } = w.config.wallet;
  const short = ind.amount != null && w.balance != null && w.balance < ind.amount;
  return (
    <div className="mt-5 border border-ink bg-bone p-5">
      <h3 className="font-display text-lg tracking-tightest">Pay with {symbol} <span className="font-sans text-sm font-medium text-mute">on {chain.name}</span></h3>
      <dl className="mt-3">
        <div className={row}><dt className="text-mute">Order total</dt><dd className="font-semibold tabular-nums">{totalCentavos != null ? peso(totalCentavos) : '...'}</dd></div>
        <div className={row}><dt className="text-mute">{symbol} price</dt><dd className="font-semibold tabular-nums">{ind.rate ? `₱${ind.rate}` : ind.loading ? '...' : 'Unavailable'}</dd></div>
        <div className={`${row} border-0`}><dt className="text-mute">You pay about</dt><dd className="font-display text-2xl tracking-tightest tabular-nums text-gold-deep">{ind.display ? `${ind.display} ${symbol}` : '...'}</dd></div>
      </dl>
      <p className="text-xs text-mute">The exact amount is locked for 15 minutes when you place the order, then your wallet asks you to confirm one transfer. Network fees are paid in ETH on {chain.name}.</p>

      {w.ready && w.address ? (
        <button type="button" onClick={w.openAccount} className="mt-3 flex w-full items-center justify-between gap-3 border border-line bg-paper px-3 py-2 text-left text-xs hover:border-ink">
          <span><span className="font-mono font-semibold">{shortAddress(w.address)}</span> <span className="text-mute">connected</span>{!w.onChain && <span className="ml-2 text-red-600">Wrong network</span>}</span>
          <span className="tabular-nums text-mute">{w.config.wallet.contract ? (w.onChain ? <>Balance <b className="text-ink">{w.balance == null ? '...' : formatUnits(w.balance, decimals)}</b> {symbol}</> : chain.name) : 'Token pending'}</span>
        </button>
      ) : (
        <button type="button" onClick={w.openConnect} className="btn-outline mt-3 w-full">Connect wallet</button>
      )}
      {w.ready && w.address && !w.onChain && (
        <button type="button" onClick={() => void w.switchNetwork()} className="btn-primary btn-sm mt-2 w-full" disabled={w.busy} aria-busy={w.busy}>{w.busy ? 'Check your wallet...' : `Switch to ${chain.name}`}</button>
      )}
      {short && <p className="mt-2 text-xs text-red-600" role="alert">Your wallet holds less {symbol} than this order needs.</p>}
      {w.error && <p className="mt-2 text-xs text-red-600" role="alert">{w.error}</p>}
    </div>
  );
}

// ---------- the payment itself ----------

export interface LivePaymentJob { orderNumber: string; token: string }
type Phase = 'loading' | 'wallet' | 'sent' | 'paid' | 'review' | 'declined' | 'error';

/**
 * Pays an order that already exists: fetches the locked amount, asks the wallet for the transfer, hands the hash to the server
 * and polls until the blockchain confirms it. Used right after checkout and from the order page ("Pay now").
 */
export function LivePaymentModal({ job, onClose, onDone }: { job: LivePaymentJob | null; onClose: () => void; onDone: (orderNumber: string, token: string) => void }) {
  const w = useLiveWallet();
  const [phase, setPhase] = useState<Phase>('loading');
  const [view, setView] = useState<TokenPaymentView | null>(null);
  const [err, setErr] = useState('');
  const runId = useRef(0);
  const url = job ? `/api/orders/${encodeURIComponent(job.orderNumber)}/palladium-pay` : '';

  const settle = useCallback((v: TokenPaymentView) => {
    setView(v);
    if (v.state === 'PAID') setPhase('paid');
    else if (v.state === 'REVIEW') setPhase('review');
    else if (v.state === 'FAILED' || v.state === 'REJECTED') { setErr(v.note ?? 'The payment did not go through.'); setPhase('error'); }
    else setPhase('sent');
    return v.state;
  }, []);

  const run = useCallback(async (j: LivePaymentJob) => {
    const mine = ++runId.current;
    const alive = () => runId.current === mine;
    setPhase('loading'); setErr(''); setView(null);
    try {
      let v = await api<TokenPaymentView>(`${url}?t=${encodeURIComponent(j.token)}`);
      if (!alive()) return;
      // A transaction is already on its way (page reloaded mid-payment): just follow it.
      if (v.txHash && (v.state === 'PENDING' || v.state === 'CONFIRMING')) { settle(v); return; }
      if (v.state === 'PAID' || v.state === 'REVIEW') { settle(v); return; }
      if (v.expired) { v = await api<TokenPaymentView>(url, { body: { token: j.token, requote: true } }); if (!alive()) return; }
      setView(v);
      if (!w.address) { const a = await w.connect(); if (!alive()) return; if (!a) { setErr('Connect your wallet to pay.'); setPhase('error'); return; } }
      if (!w.onChain) { const ok = await w.switchNetwork(); if (!alive()) return; if (!ok) { setErr(`Switch your wallet to ${w.config.wallet.chain.name} to pay.`); setPhase('error'); return; } }
      setPhase('wallet');
      const hash = await w.sendTransfer(v.to, BigInt(v.tokenAmount));
      if (!alive()) return;
      setPhase('sent');
      const after = await api<TokenPaymentView>(url, { body: { token: j.token, txHash: hash } });
      if (!alive()) return;
      settle(after);
    } catch (e) {
      if (!alive()) return;
      if (e instanceof WalletRejectedError) { setPhase('declined'); return; }
      setErr(e instanceof ApiError || e instanceof Error ? e.message : 'The payment could not be completed.');
      setPhase('error');
    }
  }, [url, w, settle]);

  useEffect(() => { if (job) void run(job); else runId.current++; }, [job, run]);

  // Poll while the chain confirms.
  useEffect(() => {
    if (!job || phase !== 'sent' || !view?.txHash) return;
    let live = true;
    const t = setInterval(async () => {
      try { const v = await api<TokenPaymentView>(`${url}?t=${encodeURIComponent(job.token)}`); if (live) settle(v); } catch { /* keep polling */ }
    }, 3000);
    return () => { live = false; clearInterval(t); };
  }, [job, phase, view?.txHash, url, settle]);

  useEffect(() => { if (phase === 'paid') void w.refreshBalance(); }, [phase, w]);

  const busy = phase === 'loading' || phase === 'wallet' || phase === 'sent';
  const symbol = view?.symbol ?? w.config.wallet.symbol;
  const amount = view ? `${view.tokenAmountDisplay} ${symbol}` : '...';
  const kv = (k: string, v: React.ReactNode) => <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"><dt className="text-mute">{k}</dt><dd className="min-w-0 text-right font-semibold tabular-nums">{v}</dd></div>;
  const txLink = view?.txHash ? <a className="font-mono underline underline-offset-4" href={explorerTxUrl(w.config.wallet.chain, view.txHash)} target="_blank" rel="noopener noreferrer">{view.txHash.slice(0, 10)}...{view.txHash.slice(-6)}</a> : '-';
  const title = phase === 'paid' ? 'Payment confirmed' : phase === 'review' ? 'Payment received, under review' : phase === 'declined' ? 'Payment not sent' : phase === 'error' ? 'Payment problem' : `Pay with ${symbol}`;
  const finish = () => { if (job && phase === 'paid') onDone(job.orderNumber, job.token); else onClose(); };

  return (
    <Modal open={!!job} onClose={() => { if (!busy) finish(); }} title={title}>
      {job && (phase === 'loading' || phase === 'wallet' || phase === 'sent') && (
        <div>
          <dl className="mb-4">
            {kv('Order', `#${job.orderNumber}`)}
            {kv('Amount', amount)}
            {view && kv('Order total', peso(view.totalCentavos))}
            {view && kv('Rate', `₱${view.rate} per ${symbol}`)}
            {view?.txHash && kv('Transaction', txLink)}
          </dl>
          <ol className="space-y-3" aria-live="polite">
            {[
              ['Locking your amount', phase !== 'loading'],
              ['Confirm the transfer in your wallet', phase === 'sent'],
              [view?.confirmations ? `Waiting for ${w.config.wallet.chain.name} (${view.confirmations.have} of ${view.confirmations.need} confirmations)` : `Waiting for ${w.config.wallet.chain.name} to confirm`, false],
            ].map(([label, done], i) => {
              const active = (phase === 'loading' && i === 0) || (phase === 'wallet' && i === 1) || (phase === 'sent' && i === 2);
              return (
                <li key={String(label)} className={`flex items-center gap-3 text-sm ${done ? 'text-ink' : active ? 'font-semibold text-ink' : 'text-mute/60'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${done ? 'border-gold bg-gold text-ink' : active ? 'border-ink' : 'border-line'}`} aria-hidden="true">{done ? '✓' : active ? <span className="h-2 w-2 animate-pulse rounded-full bg-ink" /> : ''}</span>
                  {label as string}
                </li>
              );
            })}
          </ol>
          {phase === 'wallet' && <p className="mt-4 text-xs text-mute">Your wallet shows one transfer of {amount} to Palladium&apos;s wallet. Nothing else is requested.</p>}
          {phase === 'sent' && <p className="mt-4 text-xs text-mute">You can close this window. Your order page keeps checking, and we email you as soon as the payment is confirmed.</p>}
          {phase === 'sent' && <div className="mt-4 flex justify-end"><button type="button" className="btn-ghost btn-sm" onClick={finish}>View order</button></div>}
        </div>
      )}

      {job && phase === 'paid' && view && (
        <div>
          <p className="font-display text-xl tracking-tightest"><span className="text-gold-deep">{'✓'}</span> PAYMENT CONFIRMED</p>
          <dl className="mt-3">
            {kv('Paid', `${view.receivedDisplay ?? view.tokenAmountDisplay} ${symbol}`)}
            {kv('Order', `#${view.orderNumber}`)}
            {kv('Transaction', txLink)}
            {kv('From', view.from ? <span className="font-mono">{shortAddress(view.from)}</span> : '-')}
            {kv('Network', w.config.wallet.chain.name)}
          </dl>
          <div className="mt-5 flex justify-end"><button type="button" className="btn-primary btn-sm" onClick={finish}>View order</button></div>
        </div>
      )}

      {job && phase === 'review' && view && (
        <div>
          <p className="text-sm">{view.note ?? 'Your payment arrived and needs a manual check. Palladium will contact you.'}</p>
          <dl className="mt-3">{kv('Transaction', txLink)}{kv('Order', `#${view.orderNumber}`)}</dl>
          <div className="mt-5 flex justify-end"><button type="button" className="btn-primary btn-sm" onClick={finish}>View order</button></div>
        </div>
      )}

      {job && phase === 'declined' && (
        <div>
          <p className="text-sm">You declined the transfer in your wallet, so nothing was sent. Your order is held for 3 hours; you can pay it from the order page any time before then.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={finish}>Pay later</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => void run(job)}>Try again</button>
          </div>
        </div>
      )}

      {job && phase === 'error' && (
        <div>
          <p className="text-sm text-red-600" role="alert">{err}</p>
          <p className="mt-2 text-xs text-mute">Your order is held for 3 hours. If tokens left your wallet, the order page will show the payment as soon as the chain confirms it.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={finish}>Close</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => void run(job)}>Try again</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
