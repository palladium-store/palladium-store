'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface View { status: string; paymentStatus: string; qr: { imageUrl: string; expiresAt: number; expired: boolean } | null }
const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function QrPayment({ orderNumber, token, amount }: { orderNumber: string; token: string; amount: string }) {
  const router = useRouter();
  const url = `/api/orders/${encodeURIComponent(orderNumber)}/qr?t=${encodeURIComponent(token)}`;
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const paidRef = useRef(false);

  const apply = useCallback((d: View) => {
    setV(d);
    if (d.paymentStatus === 'PAID' && !paidRef.current) { paidRef.current = true; router.refresh(); }
  }, [router]);

  const poll = useCallback(async () => {
    try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) apply(await r.json()); } catch { /* retry on next tick */ }
  }, [url, apply]);

  useEffect(() => { poll(); const i = setInterval(poll, 5000); return () => clearInterval(i); }, [poll]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  async function generate() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(url, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) setErr(d?.error?.message ?? 'Could not create a QR code. Please try again.'); else apply(d);
    } catch { setErr('Network problem. Please try again.'); }
    setBusy(false);
  }

  if (v?.paymentStatus === 'PAID') return null;
  const qr = v?.qr;
  const expired = !!qr && qr.expiresAt <= now;
  return (
    <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      {qr && !expired ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.imageUrl} alt={`QR Ph code to pay ${amount} for order ${orderNumber}`} width={240} height={240} className="h-60 w-60 border border-line bg-white p-2" />
          <div className="text-sm">
            <p className="font-semibold">Scan with your bank or e-wallet app</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-mute">
              <li>Open GCash, Maya, or any QR Ph-enabled banking app.</li>
              <li>Choose Scan QR (or Pay with QR) and scan this code.</li>
              <li>Check that the amount is {amount}, then confirm.</li>
            </ol>
            <p className="mt-3 text-xs text-mute" aria-live="polite">This code expires in {fmt(qr.expiresAt - now)}. This page updates by itself once we receive your payment.</p>
          </div>
        </>
      ) : (
        <div className="text-sm">
          <p className="font-semibold">{expired ? 'This QR code has expired.' : v ? 'Your QR code is not ready yet.' : 'Checking payment...'}</p>
          {v && <button type="button" onClick={generate} aria-busy={busy} disabled={busy} className="btn-primary btn-sm mt-3">{busy ? 'Please wait...' : expired ? 'Get a new QR code' : 'Show my QR code'}</button>}
        </div>
      )}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
