'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Badge, EmptyState } from '@/components/ui/bits';
import { peso, toCentavos, toPesos } from '@/lib/money';
import { Field, Toggle, inputCls } from './Field';

export interface DiscountRow {
  id: string; code: string; type: 'PERCENTAGE' | 'FIXED'; value: number; minOrderCentavos: number; maxDiscountCentavos: number | null;
  startsAt: string | null; endsAt: string | null; startsLabel: string; endsLabel: string; usageLimit: number | null; perCustomerLimit: number | null; timesUsed: number;
  productIds: string[]; categoryIds: string[]; isActive: boolean; state: 'ACTIVE' | 'EXPIRED' | 'SCHEDULED' | 'DISABLED';
}
interface Opt { id: string; name: string }
interface Form {
  code: string; type: 'PERCENTAGE' | 'FIXED'; value: string; minOrder: string; maxDiscount: string; startsAt: string; endsAt: string;
  usageLimit: string; perCustomerLimit: string; productIds: string[]; categoryIds: string[]; isActive: boolean;
}

const STATE_BADGE: Record<DiscountRow['state'], { status: string; label: string }> = {
  ACTIVE: { status: 'ACTIVE', label: 'Active' }, EXPIRED: { status: 'CANCELLED', label: 'Expired' },
  SCHEDULED: { status: 'PROCESSING', label: 'Scheduled' }, DISABLED: { status: 'DRAFT', label: 'Disabled' },
};
// datetime-local inputs are entered in Manila time (UTC+8).
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16) : '');
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00+08:00`).toISOString() : null);
const pesoText = (c: number) => (Number.isInteger(toPesos(c)) ? String(toPesos(c)) : toPesos(c).toFixed(2));

const emptyForm = (): Form => ({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxDiscount: '', startsAt: '', endsAt: '', usageLimit: '', perCustomerLimit: '', productIds: [], categoryIds: [], isActive: true });
const formFromRow = (r: DiscountRow): Form => ({
  code: r.code, type: r.type, value: r.type === 'FIXED' ? pesoText(r.value) : String(r.value), minOrder: r.minOrderCentavos ? pesoText(r.minOrderCentavos) : '',
  maxDiscount: r.maxDiscountCentavos ? pesoText(r.maxDiscountCentavos) : '', startsAt: toLocalInput(r.startsAt), endsAt: toLocalInput(r.endsAt),
  usageLimit: r.usageLimit?.toString() ?? '', perCustomerLimit: r.perCustomerLimit?.toString() ?? '', productIds: r.productIds, categoryIds: r.categoryIds, isActive: r.isActive,
});
const payload = (f: Form) => ({
  code: f.code.trim().toUpperCase(), type: f.type,
  value: f.type === 'FIXED' ? toCentavos(f.value) : Number(f.value),
  minOrderCentavos: f.minOrder.trim() ? toCentavos(f.minOrder) : 0,
  maxDiscountCentavos: f.maxDiscount.trim() ? toCentavos(f.maxDiscount) : null,
  startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt),
  usageLimit: f.usageLimit.trim() ? Number(f.usageLimit) : null, perCustomerLimit: f.perCustomerLimit.trim() ? Number(f.perCustomerLimit) : null,
  productIds: f.productIds, categoryIds: f.categoryIds, isActive: f.isActive,
});

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const code = f.code.trim().toUpperCase();
  if (code.length < 3) e.code = 'Code must be at least 3 characters.'; else if (code.length > 40) e.code = 'Code must be 40 characters or fewer.'; else if (!/^[A-Z0-9_-]+$/.test(code)) e.code = 'Letters, numbers, dash, underscore.';
  const v = Number(f.value);
  if (f.value.trim() === '' || !Number.isFinite(v) || v <= 0) e.value = 'Enter a value greater than 0.';
  else if (f.type === 'PERCENTAGE' && (!Number.isInteger(v) || v > 100)) e.value = 'Enter a whole percentage from 1 to 100.';
  else if (f.type === 'FIXED' && toCentavos(f.value) < 1) e.value = 'Enter at least PHP 0.01.';
  const money = (key: string, s: string) => { if (s.trim() && (!Number.isFinite(Number(s)) || Number(s) < 0)) e[key] = 'Enter an amount of 0 or more.'; };
  money('minOrderCentavos', f.minOrder);
  if (f.maxDiscount.trim() && (!Number.isFinite(Number(f.maxDiscount)) || toCentavos(f.maxDiscount) < 1)) e.maxDiscountCentavos = 'Enter an amount greater than 0.';
  for (const [k, s] of [['usageLimit', f.usageLimit], ['perCustomerLimit', f.perCustomerLimit]] as const) {
    if (s.trim() && (!Number.isInteger(Number(s)) || Number(s) < 1)) e[k] = 'Enter a whole number of 1 or more.';
  }
  if (f.startsAt && f.endsAt && new Date(`${f.endsAt}:00+08:00`) <= new Date(`${f.startsAt}:00+08:00`)) e.endsAt = 'End must be after the start.';
  return e;
}

function Checklist({ options, selected, onChange, empty }: { options: Opt[]; selected: string[]; onChange: (ids: string[]) => void; empty: string }) {
  const [filter, setFilter] = useState('');
  const shown = options.filter((o) => o.name.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="border border-line">
      {options.length > 6 && <input className="w-full border-b border-line px-3 py-2 text-sm outline-none" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter list" />}
      <div className="max-h-40 overflow-y-auto p-2">
        {options.length === 0 && <p className="p-2 text-xs text-mute">{empty}</p>}
        {shown.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm hover:bg-bone">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))} />
            <span>{o.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function DiscountManager({ rows, products, categories }: { rows: DiscountRow[]; products: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<DiscountRow | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<DiscountRow | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const closeEditor = useCallback(() => { if (!busy) setEditing(null); }, [busy]);
  const closeDelete = useCallback(() => setDel(null), []);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k];

  function openNew() { setForm(emptyForm()); setErrors({}); setFormError(null); setEditing('new'); }
  function openEdit(r: DiscountRow) { setForm(formFromRow(r)); setErrors({}); setFormError(null); setEditing(r); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) { setFormError('Please fix the highlighted fields.'); return; }
    setFormError(null); setBusy(true);
    try {
      if (editing === 'new') { await api('/api/admin/discounts', { method: 'POST', body: payload(form) }); toast('Discount created.'); }
      else if (editing) { await api(`/api/admin/discounts/${editing.id}`, { method: 'PUT', body: payload(form) }); toast('Discount updated.'); }
      setEditing(null);
      router.refresh();
    } catch (er) {
      if (er instanceof ApiError) { setErrors(er.fields ?? {}); setFormError(er.message); } else setFormError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }
  async function toggle(r: DiscountRow) {
    setToggling(r.id);
    try {
      await api(`/api/admin/discounts/${r.id}`, { method: 'PUT', body: payload({ ...formFromRow(r), isActive: !r.isActive }) });
      toast(r.isActive ? `${r.code} disabled.` : `${r.code} enabled.`);
      router.refresh();
    } catch (er) { toast(er instanceof ApiError ? er.message : 'Could not update the discount.', 'error'); }
    setToggling(null);
  }
  async function remove() {
    if (!del) return;
    setBusy(true);
    try {
      const res = await api<{ disabled: boolean }>(`/api/admin/discounts/${del.id}`, { method: 'DELETE' });
      toast(res.disabled ? `${del.code} was already used, so it was disabled and kept for order history.` : `${del.code} deleted.`);
      setDel(null);
      router.refresh();
    } catch (er) { toast(er instanceof ApiError ? er.message : 'Could not delete the discount.', 'error'); }
    setBusy(false);
  }

  const scope = (r: DiscountRow) => {
    const parts = [r.productIds.length ? `${r.productIds.length} product${r.productIds.length === 1 ? '' : 's'}` : '', r.categoryIds.length ? `${r.categoryIds.length} categor${r.categoryIds.length === 1 ? 'y' : 'ies'}` : ''].filter(Boolean);
    return parts.length ? parts.join(' + ') : 'All products';
  };
  const btn = 'rounded-md border border-line px-2 py-1 text-[11px] font-semibold hover:bg-ink hover:text-paper disabled:opacity-40';

  return (
    <>
      <div className="mb-4 flex justify-end"><button className="btn-primary btn-sm" onClick={openNew}>Create discount</button></div>
      {rows.length === 0 ? <EmptyState title="No discount codes yet" text="Create a code such as WELCOME10 to reward new customers." action={<button className="btn-primary btn-sm" onClick={openNew}>Create discount</button>} />
        : (
          <div className="table-wrap">
            <table className="tbl min-w-[1100px]">
              <thead><tr><th>Code</th><th>Discount</th><th className="text-right">Min order</th><th className="text-right">Max discount</th><th>Starts</th><th>Ends</th><th className="text-right">Used</th><th className="text-right">Per customer</th><th>Applies to</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono font-semibold">{r.code}</td>
                    <td className="whitespace-nowrap">{r.type === 'PERCENTAGE' ? `${r.value}% off` : `${peso(r.value)} off`}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{r.minOrderCentavos ? peso(r.minOrderCentavos) : '-'}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{r.maxDiscountCentavos ? peso(r.maxDiscountCentavos) : '-'}</td>
                    <td className="whitespace-nowrap text-xs">{r.startsLabel || '-'}</td>
                    <td className="whitespace-nowrap text-xs">{r.endsLabel || 'No end'}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{r.timesUsed} / {r.usageLimit ?? 'unlimited'}</td>
                    <td className="text-right tabular-nums">{r.perCustomerLimit ?? '-'}</td>
                    <td className="whitespace-nowrap text-xs">{scope(r)}</td>
                    <td><Badge status={STATE_BADGE[r.state].status} label={STATE_BADGE[r.state].label} /></td>
                    <td><div className="flex flex-wrap justify-end gap-1">
                      <button className={btn} onClick={() => openEdit(r)}>Edit</button>
                      <button className={btn} onClick={() => toggle(r)} disabled={toggling === r.id}>{toggling === r.id ? 'Saving...' : r.isActive ? 'Disable' : 'Enable'}</button>
                      <button className={`${btn} text-red-600 hover:bg-red-600`} onClick={() => setDel(r)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Modal open={!!editing} onClose={closeEditor} title={editing === 'new' ? 'Create discount' : 'Edit discount'} wide>
        <form onSubmit={save} noValidate className="space-y-4">
          {formError && <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" error={err('code')} hint="Customers type this at checkout. Not case sensitive.">
              <input className={`${inputCls(err('code'))} font-mono uppercase`} value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="WELCOME10" autoFocus />
            </Field>
            <Field label="Type">
              <select className="input" value={form.type} onChange={(e) => set('type', e.target.value as Form['type'])}>
                <option value="PERCENTAGE">Percentage off</option><option value="FIXED">Fixed amount off (PHP)</option>
              </select>
            </Field>
            <Field label={form.type === 'PERCENTAGE' ? 'Percentage (1-100)' : 'Amount off (PHP)'} error={err('value')}>
              <input className={inputCls(err('value'))} inputMode="decimal" value={form.value} onChange={(e) => set('value', e.target.value)} placeholder={form.type === 'PERCENTAGE' ? '10' : '500'} />
            </Field>
            <Field label="Minimum order (PHP)" error={err('minOrderCentavos')} hint="Leave blank for no minimum."><input className={inputCls(err('minOrderCentavos'))} inputMode="decimal" value={form.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></Field>
            <Field label="Maximum discount (PHP)" error={err('maxDiscountCentavos')} hint="Caps the discount, useful for percentages."><input className={inputCls(err('maxDiscountCentavos'))} inputMode="decimal" value={form.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} /></Field>
            <div />
            <Field label="Starts (Manila time)" error={err('startsAt')} hint="Leave blank to start immediately."><input type="datetime-local" className={inputCls(err('startsAt'))} value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
            <Field label="Ends (Manila time)" error={err('endsAt')} hint="Leave blank for no end date."><input type="datetime-local" className={inputCls(err('endsAt'))} value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
            <Field label="Total usage limit" error={err('usageLimit')} hint="Blank means unlimited."><input className={inputCls(err('usageLimit'))} inputMode="numeric" value={form.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} /></Field>
            <Field label="Limit per customer" error={err('perCustomerLimit')} hint="Blank means unlimited."><input className={inputCls(err('perCustomerLimit'))} inputMode="numeric" value={form.perCustomerLimit} onChange={(e) => set('perCustomerLimit', e.target.value)} /></Field>
            <Field label={`Products (${form.productIds.length} selected)`} hint="Leave empty to apply to all products.">
              <Checklist options={products} selected={form.productIds} onChange={(ids) => set('productIds', ids)} empty="No products yet." />
            </Field>
            <Field label={`Categories (${form.categoryIds.length} selected)`} hint="Leave empty to apply to all categories.">
              <Checklist options={categories} selected={form.categoryIds} onChange={(ids) => set('categoryIds', ids)} empty="No categories yet." />
            </Field>
          </div>
          <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" hint="Disabled codes are rejected at checkout." />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" aria-busy={busy} disabled={busy}>{busy ? 'Saving...' : editing === 'new' ? 'Create discount' : 'Save changes'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!del} title="Delete discount?" danger confirmLabel={del && del.timesUsed > 0 ? 'Disable code' : 'Delete code'} busy={busy} onConfirm={remove} onClose={closeDelete}
        message={del && <>Delete <strong className="font-mono text-ink">{del.code}</strong>? {del.timesUsed > 0 ? `It has been used ${del.timesUsed} time${del.timesUsed === 1 ? '' : 's'}, so it will be disabled instead and kept for order history.` : 'This cannot be undone. Codes that have been used are disabled instead of deleted.'}</>} />
    </>
  );
}
