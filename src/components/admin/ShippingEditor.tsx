'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/modal';
import { ZONES, PROVINCES } from '@/lib/ph';
import { toCentavos, toPesos } from '@/lib/money';
import { Field, inputCls } from './Field';

export interface ZoneData {
  id?: string; name: string; provinces: string[];
  rates: { id?: string; name: string; minWeightGrams: number; maxWeightGrams: number | null; rateCentavos: number; freeOverCentavos: number | null; courier: string | null }[];
}
interface RateRow { key: number; name: string; min: string; max: string; fee: string; freeOver: string; courier: string }
interface ZoneRow { key: number; id?: string; name: string; provinces: string[]; rates: RateRow[] }
let seq = 0;
const pesosText = (c: number | null) => (c == null ? '' : Number.isInteger(toPesos(c)) ? String(toPesos(c)) : toPesos(c).toFixed(2));
const blankRate = (): RateRow => ({ key: ++seq, name: 'Standard', min: '0', max: '', fee: '', freeOver: '', courier: '' });
const MAX_CENTAVOS = 100_000_000;

export function ShippingEditor({ initial }: { initial: ZoneData[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [zones, setZones] = useState<ZoneRow[]>(() => initial.map((z) => ({
    key: ++seq, id: z.id, name: z.name, provinces: z.provinces,
    rates: z.rates.map((r) => ({ key: ++seq, name: r.name, min: String(r.minWeightGrams), max: r.maxWeightGrams == null ? '' : String(r.maxWeightGrams), fee: pesosText(r.rateCentavos), freeOver: pesosText(r.freeOverCentavos), courier: r.courier ?? '' })),
  })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<ZoneRow | null>(null);

  const patchZone = (key: number, p: Partial<ZoneRow>) => setZones((zs) => zs.map((z) => (z.key === key ? { ...z, ...p } : z)));
  const patchRate = (zk: number, rk: number, p: Partial<RateRow>) => setZones((zs) => zs.map((z) => (z.key === zk ? { ...z, rates: z.rates.map((r) => (r.key === rk ? { ...r, ...p } : r)) } : z)));

  // province -> names of the zones that include it
  const assignment = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const z of zones) for (const p of z.provinces) m.set(p, [...(m.get(p) ?? []), z.name.trim() || 'Untitled zone']);
    return m;
  }, [zones]);
  const conflicts = [...assignment.entries()].filter(([, names]) => names.length > 1);
  const unassigned = PROVINCES.filter((p) => !assignment.has(p));

  function toggleProvince(z: ZoneRow, p: string, on: boolean) { patchZone(z.key, { provinces: on ? [...z.provinces, p] : z.provinces.filter((x) => x !== p) }); }
  function toggleRegion(z: ZoneRow, list: string[], on: boolean) { patchZone(z.key, { provinces: on ? [...new Set([...z.provinces, ...list])] : z.provinces.filter((x) => !list.includes(x)) }); }

  function validate() {
    const e: Record<string, string> = {};
    const names = new Set<string>();
    if (zones.length === 0) e.zones = 'Add at least one zone, or customers will not be able to check out.';
    zones.forEach((z, zi) => {
      const n = z.name.trim();
      if (!n) e[`${zi}.name`] = 'Enter a zone name.'; else if (n.length > 60) e[`${zi}.name`] = 'Use 60 characters or fewer.'; else if (names.has(n.toLowerCase())) e[`${zi}.name`] = 'Each zone needs a different name.';
      names.add(n.toLowerCase());
      if (z.rates.length === 0) e[`${zi}.rates`] = 'Add at least one rate.';
      z.rates.forEach((r, ri) => {
        const p = `${zi}.rates.${ri}.`;
        if (!r.name.trim()) e[p + 'name'] = 'Required.'; else if (r.name.trim().length > 60) e[p + 'name'] = 'Max 60 characters.';
        const min = Number(r.min === '' ? '0' : r.min);
        if (!Number.isInteger(min) || min < 0) e[p + 'min'] = 'Whole grams, 0 or more.';
        if (r.max.trim() !== '') {
          const max = Number(r.max);
          if (!Number.isInteger(max) || max < 1) e[p + 'max'] = 'Whole grams, 1 or more.'; else if (Number.isInteger(min) && max <= min) e[p + 'max'] = 'Must be above the minimum.';
        }
        const fee = Number(r.fee);
        if (r.fee.trim() === '' || !Number.isFinite(fee) || fee < 0 || toCentavos(fee) > MAX_CENTAVOS) e[p + 'fee'] = 'Enter a fee of 0 or more.';
        if (r.freeOver.trim() !== '') { const fo = Number(r.freeOver); if (!Number.isFinite(fo) || fo < 0 || toCentavos(fo) > MAX_CENTAVOS) e[p + 'freeOver'] = 'Enter an amount of 0 or more.'; }
        if (r.courier.length > 60) e[p + 'courier'] = 'Max 60 characters.';
      });
    });
    return e;
  }

  async function save() {
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) { setFormError('Please fix the highlighted fields before saving.'); return; }
    setFormError(null); setSaving(true);
    const body = zones.map((z) => ({
      ...(z.id ? { id: z.id } : {}), name: z.name.trim(), provinces: z.provinces,
      rates: z.rates.map((r) => ({
        name: r.name.trim(), minWeightGrams: Number(r.min === '' ? '0' : r.min), maxWeightGrams: r.max.trim() === '' ? null : Number(r.max),
        rateCentavos: toCentavos(r.fee), freeOverCentavos: r.freeOver.trim() === '' ? null : toCentavos(r.freeOver), courier: r.courier.trim() || null,
      })),
    }));
    try {
      await api('/api/admin/shipping', { method: 'PUT', body });
      toast('Shipping zones saved.');
      router.refresh();
    } catch (er) {
      if (er instanceof ApiError) {
        setFormError(er.message);
        // Server paths look like "0.rates.1.rateCentavos"; map to this form's keys.
        const mapped: Record<string, string> = {};
        for (const [k, m] of Object.entries(er.fields ?? {})) mapped[k.replace('rateCentavos', 'fee').replace('freeOverCentavos', 'freeOver').replace('minWeightGrams', 'min').replace('maxWeightGrams', 'max')] = m;
        setErrors(mapped);
        toast(er.message, 'error');
      } else { setFormError('Something went wrong. Please try again.'); toast('Something went wrong. Please try again.', 'error'); }
    }
    setSaving(false);
  }

  return (
    <div className="max-w-5xl space-y-5 pb-24">
      <p className="text-sm text-mute">Customers are quoted the lowest matching rate for their province and order weight. A rate applies when the order weight falls between its minimum and maximum. Set a free-shipping threshold to waive the fee on larger orders.</p>
      {formError && <div className="border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{formError}</div>}
      {errors.zones && <p className="field-error">{errors.zones}</p>}
      {conflicts.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p className="font-semibold">{conflicts.length} province{conflicts.length === 1 ? ' is' : 's are'} assigned to more than one zone.</p>
          <p className="text-xs">Checkout uses the first matching zone, so rates for these provinces may be unpredictable. Keep each province in one zone.</p>
          <ul className="mt-2 list-disc pl-5 text-xs">{conflicts.map(([p, names]) => <li key={p}><strong>{p}</strong>: {names.join(', ')}</li>)}</ul>
        </div>
      )}
      {unassigned.length > 0 && zones.length > 0 && (
        <div className="border border-line bg-white p-4 text-sm text-mute"><strong className="text-ink">{unassigned.length} province{unassigned.length === 1 ? '' : 's'} not in any zone.</strong> Customers there cannot check out: {unassigned.slice(0, 12).join(', ')}{unassigned.length > 12 ? `, and ${unassigned.length - 12} more` : ''}.</div>
      )}

      {zones.map((z, zi) => (
        <section key={z.key} className="card p-5">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Zone name" error={errors[`${zi}.name`]} className="w-full sm:w-72"><input className={inputCls(errors[`${zi}.name`])} value={z.name} onChange={(e) => patchZone(z.key, { name: e.target.value })} /></Field>
            <span className="pb-2 text-sm text-mute">{z.provinces.length} province{z.provinces.length === 1 ? '' : 's'}</span>
            <button type="button" className="btn-ghost btn-sm ml-auto text-red-600" onClick={() => setRemoving(z)}>Remove zone</button>
          </div>

          <div className="table-wrap mb-2">
            <table className="tbl min-w-[860px]">
              <thead><tr><th>Rate name</th><th>Min weight (g)</th><th>Max weight (g)</th><th>Fee (PHP)</th><th>Free over (PHP)</th><th>Courier</th><th></th></tr></thead>
              <tbody>
                {z.rates.map((r, ri) => {
                  const p = `${zi}.rates.${ri}.`;
                  const cell = (k: keyof RateRow, ek: string, ph?: string, w = 'w-28') => (
                    <div><input className={`${inputCls(errors[p + ek])} ${w}`} value={r[k] as string} placeholder={ph} aria-label={ek} onChange={(e) => patchRate(z.key, r.key, { [k]: e.target.value } as Partial<RateRow>)} />{errors[p + ek] && <p className="field-error">{errors[p + ek]}</p>}</div>
                  );
                  return (
                    <tr key={r.key}>
                      <td>{cell('name', 'name', 'Standard', 'w-40')}</td>
                      <td>{cell('min', 'min', '0')}</td>
                      <td>{cell('max', 'max', 'No limit')}</td>
                      <td>{cell('fee', 'fee', '0.00')}</td>
                      <td>{cell('freeOver', 'freeOver', 'Never')}</td>
                      <td>{cell('courier', 'courier', 'e.g. LBC', 'w-32')}</td>
                      <td className="text-right"><button type="button" className="text-xs font-semibold text-red-600 underline disabled:opacity-40" disabled={z.rates.length <= 1} onClick={() => patchZone(z.key, { rates: z.rates.filter((x) => x.key !== r.key) })}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {errors[`${zi}.rates`] && <p className="field-error">{errors[`${zi}.rates`]}</p>}
          <button type="button" className="btn-outline btn-sm mb-4" onClick={() => patchZone(z.key, { rates: [...z.rates, blankRate()] })}>Add rate</button>

          <details className="border border-line">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold">Provinces in this zone ({z.provinces.length})</summary>
            <div className="space-y-4 border-t border-line p-4">
              {Object.entries(ZONES).map(([region, list]) => {
                const selected = list.filter((p) => z.provinces.includes(p)).length;
                return (
                  <fieldset key={region}>
                    <legend className="mb-2 flex w-full flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider text-mute">
                      {region} ({selected}/{list.length})
                      <button type="button" className="normal-case underline" onClick={() => toggleRegion(z, list, true)}>Select all</button>
                      <button type="button" className="normal-case underline" onClick={() => toggleRegion(z, list, false)}>Clear</button>
                    </legend>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
                      {list.map((p) => {
                        const also = (assignment.get(p) ?? []).length > 1;
                        return (
                          <label key={p} className={`flex cursor-pointer items-center gap-2 text-sm ${also && z.provinces.includes(p) ? 'font-semibold text-amber-700' : ''}`}>
                            <input type="checkbox" checked={z.provinces.includes(p)} onChange={(e) => toggleProvince(z, p, e.target.checked)} />{p}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </details>
        </section>
      ))}

      <button type="button" className="btn-outline btn-sm" onClick={() => setZones((zs) => [...zs, { key: ++seq, name: '', provinces: [], rates: [blankRate()] }])}>Add zone</button>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-3">
          {conflicts.length > 0 && <span className="text-xs text-amber-700">Provinces assigned twice</span>}
          <button type="button" className="btn-primary" onClick={save} aria-busy={saving} disabled={saving}>{saving ? 'Saving...' : 'Save shipping'}</button>
        </div>
      </div>

      <ConfirmDialog open={!!removing} title="Remove zone?" danger confirmLabel="Remove zone" onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) setZones((zs) => zs.filter((x) => x.key !== removing.key)); setRemoving(null); }}
        message={removing && <>Remove <strong className="text-ink">{removing.name || 'this zone'}</strong> and its rates? The change is applied when you save shipping.</>} />
    </div>
  );
}
