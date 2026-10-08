'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PROVINCES, NCR_CITIES } from '@/lib/ph';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/bits';
import { useCart } from './cart-context';
import { useQuote } from './use-quote';
import { QuoteTotals, SummaryLine } from './order-summary';
import { METHOD_LABEL, METHOD_SHORT } from './labels';
import type { SavedAddress } from './types';
import { PalladiumPayPanel, PalladiumPaymentModal, type PaymentJob } from './palladium/checkout';
import { usePalladiumWallet } from './palladium/wallet';
import { formatPalladiumMinor } from '@/lib/palladium-price';
import { LivePayPanel, LivePaymentModal, useIndicativeAmount, type LivePaymentJob } from './palladium/live-checkout';
import { useLiveWallet } from './palladium/live-wallet';

interface Props {
  /** Arrived from a "Pay with crypto" button: start with PALLADIUM selected. */
  preferCrypto?: boolean;
  methods: { id: string; instructions: string }[];
  user: { name: string; email: string; phone: string | null } | null;
  storeEmail: string;
}
const strip = (s: string) => s.replace(/[\s-]/g, '');

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-mute">{hint}</p>}
      {error && <p id={`${id}-err`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function CheckoutForm({ methods, user, storeEmail, preferCrypto = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { lines, ready, clear } = useCart();
  const wallet = usePalladiumWallet();
  const live = useLiveWallet();
  // Real wallet unless the server runs the demo (never on production).
  const isLive = live.config.mode === 'live';
  const symbol = live.config.wallet.symbol;
  // PALLADIUM is a separate choice from the PHP methods.
  const phpMethods = methods.filter((m) => m.id !== 'PALLADIUM');
  const hasPalladium = methods.some((m) => m.id === 'PALLADIUM');
  const [job, setJob] = useState<PaymentJob | null>(null);
  const [liveJob, setLiveJob] = useState<LivePaymentJob | null>(null);
  const [short, setShort] = useState<{ requiredMinor: number; availableMinor: number } | null>(null);

  const [f, setF] = useState({
    name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '',
    diff: false, rName: '', rPhone: '',
    line1: '', barangay: '', city: '', province: '', postalCode: '',
    notes: '', method: preferCrypto && hasPalladium ? 'PALLADIUM' : (phpMethods[0]?.id ?? (hasPalladium ? 'PALLADIUM' : '')),
    createAccount: false, password: '', saveAddress: false, marketing: false,
  });
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const [code, setCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [topErr, setTopErr] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});
  const keyRef = useRef<string | null>(null);
  const submitting = useRef(false);

  const { quote, loading, error: quoteError, refresh } = useQuote(lines, { discountCode: code, province: f.province });
  const indicative = useIndicativeAmount(isLive && f.method === 'PALLADIUM' && quote ? quote.totalCentavos : null);

  // Remembered province and discount code from the cart page.
  useEffect(() => {
    try {
      const p = localStorage.getItem('pal-province'); if (p && PROVINCES.includes(p)) setF((s) => (s.province ? s : { ...s, province: p }));
      const c = localStorage.getItem('pal-discount'); if (c) { setCode(c); setCodeInput(c); }
    } catch { /* storage unavailable */ }
  }, []);

  // Saved addresses for signed-in customers.
  useEffect(() => {
    if (!user) return;
    let live = true;
    api<SavedAddress[]>('/api/account/addresses').then((list) => {
      if (!live) return;
      setSaved(list);
      const d = list.find((a) => a.isDefault) ?? list[0];
      if (d) applyAddress(d, true);
    }).catch(() => { /* picker is optional */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  function applyAddress(a: SavedAddress, onlyIfEmpty = false) {
    setF((s) => {
      if (onlyIfEmpty && (s.line1 || s.city || s.barangay)) return s;
      const diff = a.recipient.trim().toLowerCase() !== s.name.trim().toLowerCase() || strip(a.phone) !== strip(s.phone);
      return { ...s, line1: a.line1, barangay: a.barangay, city: a.city, province: a.province, postalCode: a.postalCode, diff, rName: a.recipient, rPhone: a.phone };
    });
    setPicked(a.id);
  }

  function setProvince(p: string) {
    up('province', p); setPicked(null);
    try { if (p) localStorage.setItem('pal-province', p); } catch { /* ignore */ }
  }
  function applyCode() {
    const c = codeInput.trim().toUpperCase();
    setCode(c);
    try { if (c) localStorage.setItem('pal-discount', c); else localStorage.removeItem('pal-discount'); } catch { /* ignore */ }
    if (!c) toast('Discount code removed.', 'info');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current || pending) return;
    setTopErr(null); setFe({});
    if (!lines.length) { setTopErr('Your cart is empty.'); return; }
    if (!f.method) { setTopErr('No payment method is available right now.'); return; }
    if (quote && !quote.ok) { setTopErr('Some items in your cart need attention. Review your cart before ordering.'); return; }
    if (code && quote?.discountError) { setFe({ discountCode: quote.discountError }); setTopErr('Fix or remove the discount code to continue.'); return; }
    const payToken = f.method === 'PALLADIUM';
    if (payToken) {
      if (!quote) { setTopErr('Your total is still being calculated. Try again in a moment.'); return; }
      if (isLive) {
        if (!live.address) { setTopErr(`Connect your wallet to pay with ${symbol}.`); live.openConnect(); return; }
        if (!live.onChain) { setTopErr(`Switch your wallet to ${live.config.wallet.chain.name} to pay with ${symbol}.`); return; }
        if (indicative.amount != null && live.balance != null && live.balance < indicative.amount) { setTopErr(`Your wallet holds less ${symbol} than this order needs.`); return; }
      } else {
        if (!wallet.session.connected) { setTopErr('Connect your demo wallet to pay with PALLADIUM.'); wallet.openConnect(); return; }
        const need = wallet.service.quote(quote.totalCentavos).amountMinor;
        if (!wallet.service.canAfford(need)) { setShort({ requiredMinor: need, availableMinor: wallet.session.palladiumMinor }); return; }
      }
    }
    submitting.current = true; setPending(true);
    if (!keyRef.current) keyRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let source: string | undefined;
    try { source = localStorage.getItem('pal-src') || undefined; } catch { /* ignore */ }
    try {
      const res = await api<{ orderNumber: string; token: string; redirectUrl: string | null }>('/api/checkout', {
        body: {
          idempotencyKey: keyRef.current,
          items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
          email: f.email.trim(), phone: f.phone.trim(),
          ship: { name: (f.diff ? f.rName : f.name).trim(), phone: (f.diff ? f.rPhone : f.phone).trim(), line1: f.line1.trim(), barangay: f.barangay.trim(), city: f.city.trim(), province: f.province, postalCode: f.postalCode.trim() },
          method: f.method,
          discountCode: code || undefined,
          notes: f.notes.trim() || undefined,
          createAccount: !user && f.createAccount ? true : undefined,
          password: !user && f.createAccount ? f.password : undefined,
          saveAddress: (!!user || f.createAccount) && f.saveAddress ? true : undefined,
          marketingOptIn: f.marketing || undefined,
          source,
        },
      });
      if (payToken && quote) {
        // The order exists and holds its stock (awaiting payment). Live: the server locked the token amount; the wallet pays it now.
        // Demo: run the simulated payment. Either way the cart is cleared once the payment is done.
        if (isLive) setLiveJob({ orderNumber: res.orderNumber, token: res.token });
        else {
          const first = quote.lines[0]?.productName ?? 'Palladium order';
          setJob({ orderNumber: res.orderNumber, token: res.token, phpCentavos: quote.totalCentavos, label: quote.lines.length > 1 ? `${first} +${quote.lines.length - 1} more` : first });
        }
        submitting.current = false; setPending(false);
        return;
      }
      setPlaced(true);
      toast('Order placed. Thank you!');
      clear();
      try { localStorage.removeItem('pal-discount'); } catch { /* ignore */ }
      if (res.redirectUrl) window.location.assign(res.redirectUrl);
      else router.push(`/order/${encodeURIComponent(res.orderNumber)}?t=${encodeURIComponent(res.token)}`);
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : 'Could not place your order.';
      setTopErr(msg);
      if (ex instanceof ApiError && ex.fields) setFe(ex.fields);
      toast(msg, 'error');
      submitting.current = false; setPending(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (placed) return <div className="py-20 text-center"><Spinner label="Order placed. Taking you to your confirmation" /></div>;
  if (!ready) return <Spinner label="Loading checkout" />;
  if (!lines.length) {
    return (
      <div className="border border-dashed border-line px-6 py-16 text-center">
        <p className="font-display text-2xl tracking-tightest">Your cart is empty</p>
        <p className="mt-2 text-sm text-mute">Add something to your cart before checking out.</p>
        <Link href="/shop" className="btn-primary mt-6">Continue shopping</Link>
      </div>
    );
  }

  const known = new Set(['email', 'phone', 'ship.name', 'ship.phone', 'ship.line1', 'ship.barangay', 'ship.city', 'ship.province', 'ship.postalCode', 'method', 'discountCode', 'password', 'notes']);
  const extras = Object.entries(fe).filter(([k]) => !known.has(k));
  const err = (k: string) => fe[k];
  const inp = (k: string) => `input ${err(k) ? 'input-error' : ''}`;
  const nameErr = !f.diff ? err('ship.name') : undefined;
  const phoneErr = err('phone') ?? (!f.diff ? err('ship.phone') : undefined);
  const byId = new Map((quote?.lines ?? []).map((l) => [l.variantId, l]));
  const canPlace = !pending && !!quote && quote.ok && !loading && !!f.method && (!quote.shippingError);
  const section = 'card p-5 sm:p-7';
  const h2 = 'font-display text-xl tracking-tightest';

  return (
    <>
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-6">
        {(topErr || extras.length > 0) && (
          <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <p className="font-semibold">{topErr}</p>
            {extras.length > 0 && <ul className="mt-1 list-disc pl-5">{extras.map(([k, v]) => <li key={k}>{v}</li>)}</ul>}
          </div>
        )}

        <section className={section} aria-labelledby="c-contact">
          <div className="flex items-baseline justify-between"><h2 id="c-contact" className={h2}>Contact</h2>{!user && <p className="text-xs text-mute">Have an account? <Link href="/login?next=/checkout" className="underline">Sign in</Link></p>}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field id="c-name" label="Full name" error={nameErr}><input id="c-name" className={inp('ship.name')} autoComplete="name" value={f.name} onChange={(e) => up('name', e.target.value)} aria-invalid={!!nameErr} /></Field></div>
            <Field id="c-email" label="Email" error={err('email')} hint="We send your order updates here."><input id="c-email" type="email" className={inp('email')} autoComplete="email" value={f.email} onChange={(e) => up('email', e.target.value)} aria-invalid={!!err('email')} /></Field>
            <Field id="c-phone" label="Mobile number" error={phoneErr} hint="e.g. 0917 123 4567"><input id="c-phone" type="tel" className={`input ${phoneErr ? 'input-error' : ''}`} autoComplete="tel" value={f.phone} onChange={(e) => up('phone', e.target.value)} aria-invalid={!!phoneErr} /></Field>
          </div>
        </section>

        <section className={section} aria-labelledby="c-ship">
          <h2 id="c-ship" className={h2}>Shipping address</h2>
          {saved.length > 0 && (
            <fieldset className="mt-5">
              <legend className="label">Saved addresses</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {saved.map((a) => (
                  <label key={a.id} className={`cursor-pointer border p-3 text-sm transition ${picked === a.id ? 'border-ink bg-bone' : 'border-line hover:border-ink'}`}>
                    <input type="radio" name="saved" className="sr-only" checked={picked === a.id} onChange={() => applyAddress(a)} />
                    <span className="block font-semibold">{a.label || a.recipient}{a.isDefault && <span className="ml-2 text-[10px] uppercase tracking-wider text-gold-deep">Default</span>}</span>
                    <span className="block text-mute">{a.line1}, {a.barangay}, {a.city}, {a.province} {a.postalCode}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field id="c-line1" label="Street address" error={err('ship.line1')}><input id="c-line1" className={inp('ship.line1')} autoComplete="address-line1" placeholder="House or unit number, street, subdivision" value={f.line1} onChange={(e) => { up('line1', e.target.value); setPicked(null); }} aria-invalid={!!err('ship.line1')} /></Field></div>
            <Field id="c-province" label="Province" error={err('ship.province')}>
              <select id="c-province" className={inp('ship.province')} autoComplete="address-level1" value={f.province} onChange={(e) => setProvince(e.target.value)} aria-invalid={!!err('ship.province')}>
                <option value="">Choose a province</option>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field id="c-city" label="City or municipality" error={err('ship.city')}>
              <input id="c-city" className={inp('ship.city')} autoComplete="address-level2" list={f.province === 'Metro Manila' ? 'ncr-cities' : undefined} value={f.city} onChange={(e) => { up('city', e.target.value); setPicked(null); }} aria-invalid={!!err('ship.city')} />
              {f.province === 'Metro Manila' && <datalist id="ncr-cities">{NCR_CITIES.map((c) => <option key={c} value={c} />)}</datalist>}
            </Field>
            <Field id="c-barangay" label="Barangay" error={err('ship.barangay')}><input id="c-barangay" className={inp('ship.barangay')} value={f.barangay} onChange={(e) => { up('barangay', e.target.value); setPicked(null); }} aria-invalid={!!err('ship.barangay')} /></Field>
            <Field id="c-postal" label="Postal code" error={err('ship.postalCode')}><input id="c-postal" inputMode="numeric" maxLength={4} autoComplete="postal-code" className={inp('ship.postalCode')} value={f.postalCode} onChange={(e) => { up('postalCode', e.target.value.replace(/\D/g, '')); setPicked(null); }} aria-invalid={!!err('ship.postalCode')} /></Field>
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={f.diff} onChange={(e) => up('diff', e.target.checked)} /> Deliver to someone else</label>
          {f.diff && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="c-rname" label="Recipient name" error={err('ship.name')}><input id="c-rname" className={inp('ship.name')} value={f.rName} onChange={(e) => up('rName', e.target.value)} /></Field>
              <Field id="c-rphone" label="Recipient mobile" error={err('ship.phone')}><input id="c-rphone" type="tel" className={inp('ship.phone')} value={f.rPhone} onChange={(e) => up('rPhone', e.target.value)} /></Field>
            </div>
          )}
          <div className="mt-5"><Field id="c-notes" label="Order notes (optional)" error={err('notes')}><textarea id="c-notes" rows={2} maxLength={500} className={inp('notes')} value={f.notes} onChange={(e) => up('notes', e.target.value)} placeholder="Delivery instructions, landmarks, gift message..." /></Field></div>
        </section>

        <section className={section} aria-labelledby="c-pay">
          <h2 id="c-pay" className={h2}>Payment</h2>
          {methods.length === 0 ? (
            <p className="mt-4 text-sm text-red-600">No payment methods are available right now. Please contact us at <a className="underline" href={`mailto:${storeEmail}`}>{storeEmail}</a>.</p>
          ) : (<>
            {hasPalladium && (
              <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
                <legend className="sr-only">Pay with</legend>
                {[
                  { id: 'php', label: 'PHP', sub: phpMethods.length ? phpMethods.map((m) => METHOD_LABEL[m.id] ?? m.id).join(' / ') : 'Not available right now', on: f.method !== 'PALLADIUM', off: phpMethods.length === 0, pick: () => up('method', phpMethods[0]?.id ?? '') },
                  { id: 'pal', label: 'Pay with crypto', sub: isLive ? `${symbol} on ${live.config.wallet.chain.name}` : 'PALLADIUM · simulated wallet', on: f.method === 'PALLADIUM', off: false, pick: () => up('method', 'PALLADIUM') },
                ].map((o) => (
                  <label key={o.id} className={`block border p-4 transition ${o.off ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${o.on ? 'border-ink bg-bone' : 'border-line hover:border-ink'}`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="payMode" checked={o.on} disabled={o.off} onChange={o.pick} className="accent-ink" />
                      <span className="font-semibold">{o.label}</span>
                      {o.id === 'pal' && !isLive && <span className="border border-gold px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.16em] text-gold-deep">Demo</span>}
                    </span>
                    <span className="mt-1 block pl-7 text-xs text-mute">{o.sub}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {f.method === 'PALLADIUM' ? (isLive ? <LivePayPanel totalCentavos={quote?.totalCentavos ?? null} /> : <PalladiumPayPanel totalCentavos={quote?.totalCentavos ?? null} />) : (
            <fieldset className="mt-5 space-y-3">
              <legend className="sr-only">Payment method</legend>
              {phpMethods.map((m) => (
                <label key={m.id} className={`block cursor-pointer border p-4 transition ${f.method === m.id ? 'border-ink bg-bone' : 'border-line hover:border-ink'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="method" value={m.id} checked={f.method === m.id} onChange={() => up('method', m.id)} className="accent-ink" />
                    <span className="font-semibold">{METHOD_LABEL[m.id] ?? m.id}</span>
                    <span className="ml-auto text-xs text-mute">{METHOD_SHORT[m.id]}</span>
                  </span>
                  <span className="mt-2 block pl-7 text-sm text-mute">{m.instructions}</span>
                </label>
              ))}
              {err('method') && <p className="field-error" role="alert">{err('method')}</p>}
            </fieldset>
            )}
          </>)}
        </section>

        <section className={section} aria-labelledby="c-extra">
          <h2 id="c-extra" className="sr-only">Account and preferences</h2>
          {!user && (
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="accent-ink" checked={f.createAccount} onChange={(e) => up('createAccount', e.target.checked)} /> Create an account to track orders and check out faster</label>
              {f.createAccount && (
                <div className="mt-4 max-w-sm">
                  <Field id="c-pass" label="Password" error={err('password')} hint="At least 8 characters with a letter and a number."><input id="c-pass" type="password" autoComplete="new-password" className={inp('password')} value={f.password} onChange={(e) => up('password', e.target.value)} aria-invalid={!!err('password')} /></Field>
                </div>
              )}
            </div>
          )}
          {(user || f.createAccount) && <label className={`flex cursor-pointer items-center gap-2 text-sm ${!user ? 'mt-4' : ''}`}><input type="checkbox" className="accent-ink" checked={f.saveAddress} onChange={(e) => up('saveAddress', e.target.checked)} /> Save this address for next time</label>}
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={f.marketing} onChange={(e) => up('marketing', e.target.checked)} /> Email me about new drops and offers</label>
        </section>
      </div>

      <aside className="h-fit border border-line bg-bone p-5 sm:p-7 lg:sticky lg:top-24" aria-label="Order summary">
        <h2 className={h2}>Order summary</h2>
        {quoteError && <p className="mt-3 text-sm text-red-600" role="alert">{quoteError} <button type="button" className="underline" onClick={refresh}>Try again</button></p>}
        <ul className="mt-3 divide-y divide-line">
          {lines.map((l) => {
            const q = byId.get(l.variantId);
            return <SummaryLine key={l.variantId} name={q?.productName ?? 'Loading...'} variant={q?.variantName ?? ''} image={q?.imageUrl ?? null} qty={l.qty} total={q?.lineTotalCentavos ?? 0} problem={q?.problem} />;
          })}
        </ul>
        <div className="mt-2 border-t border-line pt-4">
          <label htmlFor="c-code" className="label">Discount code</label>
          <div className="flex gap-2">
            <input id="c-code" className={`input uppercase ${err('discountCode') ? 'input-error' : ''}`} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} placeholder="Enter code" autoComplete="off" />
            <button type="button" className="btn-outline" onClick={applyCode} disabled={loading}>Apply</button>
          </div>
          {(quote?.discountError || err('discountCode')) && <p className="field-error" role="alert">{quote?.discountError ?? err('discountCode')}</p>}
        </div>
        <div className="mt-5 border-t border-line pt-4">
          {quote ? <QuoteTotals quote={quote} hasProvince={!!f.province} /> : <Spinner label="Pricing" />}
        </div>
        <button type="submit" className="btn-gold mt-6 w-full py-4" disabled={!canPlace || pending} aria-busy={pending}>{pending ? 'Placing order...' : f.method === 'PALLADIUM' ? (isLive ? (indicative.display ? `Pay about ${indicative.display} ${symbol}` : `Pay with ${symbol}`) : quote ? `Pay ${formatPalladiumMinor(wallet.service.quote(quote.totalCentavos).amountMinor)} PALLADIUM` : 'Pay with PALLADIUM') : 'Place order'}</button>
        {!pending && quote && !quote.ok && <p className="mt-2 text-xs text-red-600">Some items need attention. <Link href="/cart" className="underline">Review your cart</Link>.</p>}
        {!pending && quote?.shippingError && <p className="mt-2 text-xs text-red-600">{quote.shippingError}</p>}
        <p className="mt-3 text-center text-xs text-mute">By placing your order you agree to our <Link href="/pages/terms" className="underline">terms</Link> and <Link href="/pages/privacy" className="underline">privacy policy</Link>.</p>
      </aside>
    </form>
    <LivePaymentModal
      job={liveJob}
      onClose={() => { if (!liveJob) return; const j = liveJob; setLiveJob(null); setPlaced(true); clear(); try { localStorage.removeItem('pal-discount'); } catch { /* ignore */ } router.push(`/order/${encodeURIComponent(j.orderNumber)}?t=${encodeURIComponent(j.token)}`); }}
      onDone={(num, token) => { setLiveJob(null); setPlaced(true); clear(); try { localStorage.removeItem('pal-discount'); } catch { /* ignore */ } toast('Payment confirmed.'); router.push(`/order/${encodeURIComponent(num)}?t=${encodeURIComponent(token)}`); }}
    />
    <PalladiumPaymentModal
      job={job}
      precheck={short}
      onClose={() => { setJob(null); setShort(null); }}
      onDone={(num, token) => { setJob(null); setPlaced(true); clear(); try { localStorage.removeItem('pal-discount'); } catch { /* ignore */ } toast('Payment successful (demo).'); router.push(`/order/${encodeURIComponent(num)}?t=${encodeURIComponent(token)}`); }}
    />
  </>
  );
}
