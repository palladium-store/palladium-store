'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { api } from '@/components/ui/api-client';
import { peso } from '@/lib/money';
import { formatPalladiumMinor } from '@/lib/palladium-price';
import { DEMO_NETWORK_LABEL } from '@/lib/palladium/config';
import { InsufficientBalanceError, PAYMENT_STEPS, type PaymentReceipt } from '@/lib/palladium/types';
import { DemoTag, usePalladiumWallet } from './wallet';

/** What the customer sees when PALLADIUM is chosen at checkout. Talks only to the payment service, never to a chain. */
export function PalladiumPayPanel({ totalCentavos }: { totalCentavos: number | null }) {
  const { service, session, ready, openConnect, openAccount } = usePalladiumWallet();
  const q = totalCentavos != null ? service.quote(totalCentavos) : null;
  const row = 'flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm';
  return (
    <div className="mt-5 border border-ink bg-bone p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg tracking-tightest">Pay with PALLADIUM</h3>
        <DemoTag />
      </div>
      <div className="mt-3 border border-gold bg-gold-soft px-3 py-2 text-xs"><b>DEMO PAYMENT.</b> No real cryptocurrency will be transferred.</div>

      <dl className="mt-3">
        <div className={row}><dt className="text-mute">Order total</dt><dd className="font-semibold tabular-nums">{totalCentavos != null ? peso(totalCentavos) : '...'}</dd></div>
        <div className={row}><dt className="text-mute">PALLADIUM price</dt><dd className="font-semibold tabular-nums">{q ? peso(Math.round(q.tokenPricePhp * 100)) : '...'}</dd></div>
        <div className={`${row} border-0`}><dt className="text-mute">You pay</dt><dd className="font-display text-2xl tracking-tightest tabular-nums text-gold-deep">{q ? `${formatPalladiumMinor(q.amountMinor)} PALLADIUM` : '...'}</dd></div>
      </dl>

      {ready && session.connected ? (
        <button type="button" onClick={openAccount} className="mt-2 flex w-full items-center justify-between border border-line bg-white px-3 py-2 text-left text-xs hover:border-ink">
          <span><span className="font-mono font-semibold">{session.address}</span> <span className="text-mute">connected</span></span>
          <span className="tabular-nums text-mute">Balance <b className="text-ink">{formatPalladiumMinor(session.palladiumMinor)}</b> PALLADIUM</span>
        </button>
      ) : (
        <button type="button" onClick={openConnect} className="btn-outline mt-2 w-full">Connect wallet</button>
      )}
      {q && session.connected && session.palladiumMinor < q.amountMinor && (
        <p className="mt-2 text-xs text-red-600" role="alert">Your demo balance is lower than this order. You can reset the demo wallet from the wallet menu.</p>
      )}
    </div>
  );
}

export interface PaymentJob { orderNumber: string; token: string; phpCentavos: number; label: string }
type Phase = 'running' | 'success' | 'insufficient' | 'error';

/**
 * Runs the simulated payment for an order that has already been created, or shows the insufficient-balance notice
 * (precheck) when the wallet cannot cover the order. Either way the order only becomes PAID through the server route.
 */
export function PalladiumPaymentModal({ job, precheck, onClose, onDone }: {
  job: PaymentJob | null;
  precheck: { requiredMinor: number; availableMinor: number } | null;
  onClose: () => void;
  onDone: (orderNumber: string, token: string) => void;
}) {
  const { service, openTx } = usePalladiumWallet();
  const [phase, setPhase] = useState<Phase>('running');
  const [step, setStep] = useState(0);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [short, setShort] = useState<{ requiredMinor: number; availableMinor: number } | null>(null);
  const [err, setErr] = useState('');
  const runId = useRef(0);

  const run = useCallback(async (j: PaymentJob) => {
    const mine = ++runId.current;
    setPhase('running'); setStep(0); setReceipt(null); setShort(null); setErr('');
    try {
      const r = await service.pay({
        orderNumber: j.orderNumber, phpCentavos: j.phpCentavos, label: j.label,
        confirmOrder: async (txId, wallet) => { await api(`/api/orders/${encodeURIComponent(j.orderNumber)}/palladium-demo`, { body: { token: j.token, txId, wallet } }); },
      }, (i) => { if (runId.current === mine) setStep(i); });
      if (runId.current !== mine) return;
      setReceipt(r); setPhase('success');
    } catch (e) {
      if (runId.current !== mine) return;
      if (e instanceof InsufficientBalanceError) { setShort({ requiredMinor: e.requiredMinor, availableMinor: e.availableMinor }); setPhase('insufficient'); }
      else { setErr(e instanceof Error ? e.message : 'The demo payment could not be completed.'); setPhase('error'); }
    }
  }, [service]);

  useEffect(() => { if (job) void run(job); else runId.current++; }, [job, run]);

  const open = !!job || !!precheck;
  const insufficient = precheck ?? short;
  const showInsufficient = !!precheck || phase === 'insufficient';
  const busy = !!job && phase === 'running';
  const finish = () => { if (job && phase === 'success') onDone(job.orderNumber, job.token); else onClose(); };

  const kv = (k: string, v: React.ReactNode) => <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"><dt className="text-mute">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>;

  return (
    <Modal open={open} onClose={() => { if (!busy) finish(); }} title={showInsufficient ? 'Insufficient PALLADIUM' : phase === 'success' ? 'Payment successful' : 'PALLADIUM payment'}>
      <div className="mb-4 flex items-center gap-2 text-xs"><DemoTag /><span className="text-mute">Demo mode. Nothing here is a real cryptocurrency transaction.</span></div>

      {showInsufficient && insufficient && (
        <div>
          <p className="font-display text-lg tracking-tightest text-red-600">INSUFFICIENT PALLADIUM</p>
          <dl className="mt-3">
            {kv('Required', `${formatPalladiumMinor(insufficient.requiredMinor)} PALLADIUM`)}
            {kv('Available', `${formatPalladiumMinor(insufficient.availableMinor)} PALLADIUM`)}
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {service.resetDemo && <button type="button" className="btn-ghost btn-sm" onClick={() => { service.resetDemo?.(); onClose(); }}>Reset demo wallet</button>}
            <button type="button" className="btn-primary btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </div>
      )}

      {!showInsufficient && phase === 'running' && (
        <ol className="space-y-3" aria-live="polite">
          {PAYMENT_STEPS.map((label, i) => {
            const done = i < step, active = i === step;
            return (
              <li key={label} className={`flex items-center gap-3 text-sm transition ${done ? 'text-ink' : active ? 'font-semibold text-ink' : 'text-mute/60'}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${done ? 'border-gold bg-gold text-ink' : active ? 'border-ink' : 'border-line'}`} aria-hidden="true">
                  {done ? '\u2713' : active ? <span className="h-2 w-2 animate-pulse rounded-full bg-ink" /> : ''}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      )}

      {!showInsufficient && phase === 'success' && receipt && (
        <div>
          <p className="font-display text-xl tracking-tightest"><span className="text-gold-deep">{'\u2713'}</span> PAYMENT SUCCESSFUL</p>
          <dl className="mt-3">
            {kv('Paid', `${formatPalladiumMinor(receipt.paidMinor)} PALLADIUM`)}
            {kv('PHP value', peso(receipt.tx.phpCentavos))}
            {kv('Transaction', <span className="font-mono">{receipt.tx.txId}</span>)}
            {kv('Network', DEMO_NETWORK_LABEL)}
            {kv('Status', receipt.tx.status)}
          </dl>
          <dl className="mt-4 border border-line bg-bone px-4 py-1">
            {kv('Previous balance', `${formatPalladiumMinor(receipt.previousMinor)} PALLADIUM`)}
            {kv('Payment', `-${formatPalladiumMinor(receipt.paidMinor)} PALLADIUM`)}
            {kv('New balance', `${formatPalladiumMinor(receipt.newMinor)} PALLADIUM`)}
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-outline btn-sm" onClick={() => openTx(receipt.tx)}>View demo transaction</button>
            <button type="button" className="btn-primary btn-sm" onClick={finish}>View order</button>
          </div>
        </div>
      )}

      {!showInsufficient && phase === 'error' && job && (
        <div>
          <p className="text-sm text-red-600" role="alert">{err}</p>
          <p className="mt-2 text-xs text-mute">Nothing was deducted from your demo wallet.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={onClose}>Close</button>
            <button type="button" className="btn-primary btn-sm" onClick={() => void run(job)}>Try again</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
