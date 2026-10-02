'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { toCentavos, toPesos, peso } from '@/lib/money';
import { compressImage } from '@/lib/image-compress';
import { Field, Toggle, inputCls } from './Field';

export interface ProductInitial {
  id: string; name: string; slug: string; categoryId: string; shortDescription: string; description: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'SOLD_OUT'; tags: string[]; isFeatured: boolean; isLimited: boolean; isDemo: boolean;
  specs: Record<string, string>;
  weightGrams: number | null; lengthMm: number | null; widthMm: number | null; heightMm: number | null;
  shippingInfo: string; seoTitle: string; seoDescription: string; ogImageUrl: string;
  images: { url: string; alt: string; kind: 'image' | 'video' }[];
  variants: { id: string; name: string; sku: string; barcode: string; priceCentavos: number; compareAtCentavos: number | null; costCentavos: number; lowStockThreshold: number; imageUrl: string; isActive: boolean; onHand: number; reserved: number }[];
}

interface Media { key: string; url: string; alt: string; kind: 'image' | 'video' }
interface Row {
  key: string; id?: string; name: string; sku: string; barcode: string; price: string; compareAt: string; cost: string; threshold: string; imageUrl: string;
  isActive: boolean; initialStock: string; removed: boolean; onHand?: number; reserved?: number;
}
interface SpecRow { key: string; k: string; v: string }

let uid = 0;
const nextKey = () => `k${++uid}`;
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const pesosText = (c: number | null) => (c == null ? '' : Number.isInteger(toPesos(c)) ? String(toPesos(c)) : toPesos(c).toFixed(2));
const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s));
const isInt = (n: number) => Number.isInteger(n);
const SHOWN_INLINE = /^(name|slug|categoryId|status|variants\.\d+\.|shortDescription|description|tags|specs|weightGrams|lengthMm|widthMm|heightMm|shippingInfo|seoTitle|seoDescription|ogImageUrl|images$|images\.\d+\.alt|variants$)/;
const MAX_PESOS = 1_000_000;
const STATUS_OPTIONS: [string, string][] = [['ACTIVE', 'Active'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived'], ['SOLD_OUT', 'Sold out']];

const blankRow = (): Row => ({ key: nextKey(), name: '', sku: '', barcode: '', price: '', compareAt: '', cost: '', threshold: '5', imageUrl: '', isActive: true, initialStock: '0', removed: false });

function Counter({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return <span className={n > max ? 'text-red-600' : ''}>{n}/{max}</span>;
}

export function ProductForm({ mode, categories, initial }: { mode: 'create' | 'edit'; categories: { id: string; name: string }[]; initial?: ProductInitial }) {
  const router = useRouter();
  const { toast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const edit = mode === 'edit' && !!initial;

  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(edit);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [shortDescription, setShort] = useState(initial?.shortDescription ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<string>(initial?.status ?? 'DRAFT');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [isFeatured, setFeatured] = useState(initial?.isFeatured ?? false);
  const [isLimited, setLimited] = useState(initial?.isLimited ?? false);
  const [specs, setSpecs] = useState<SpecRow[]>(() => Object.entries(initial?.specs ?? {}).map(([k, v]) => ({ key: nextKey(), k, v })));
  const [weight, setWeight] = useState(initial?.weightGrams?.toString() ?? '');
  const [length, setLength] = useState(initial?.lengthMm?.toString() ?? '');
  const [width, setWidth] = useState(initial?.widthMm?.toString() ?? '');
  const [height, setHeight] = useState(initial?.heightMm?.toString() ?? '');
  const [shippingInfo, setShippingInfo] = useState(initial?.shippingInfo ?? '');
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initial?.ogImageUrl ?? '');
  const [media, setMedia] = useState<Media[]>(() => (initial?.images ?? []).map((i) => ({ key: nextKey(), url: i.url, alt: i.alt, kind: i.kind })));
  const [rows, setRows] = useState<Row[]>(() => initial?.variants.length
    ? initial.variants.map((v) => ({ key: nextKey(), id: v.id, name: v.name, sku: v.sku, barcode: v.barcode, price: pesosText(v.priceCentavos), compareAt: pesosText(v.compareAtCentavos), cost: pesosText(v.costCentavos), threshold: String(v.lowStockThreshold), imageUrl: v.imageUrl, isActive: v.isActive, initialStock: '0', removed: false, onHand: v.onHand, reserved: v.reserved }))
    : [blankRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState(false);

  const images = useMemo(() => media.filter((m) => m.kind === 'image'), [media]);
  const activeRows = rows.filter((r) => !r.removed);
  const removedRows = rows.filter((r) => r.removed);
  const err = (...keys: string[]) => keys.map((k) => errors[k]).find(Boolean);
  const verr = (ai: number, ...fields: string[]) => err(...fields.map((f) => `variants.${ai}.${f}`));
  const specsObj = useMemo(() => Object.fromEntries(specs.filter((s) => s.k.trim()).map((s) => [s.k.trim(), s.v])), [specs]);

  function onName(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }
  const patchRow = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const patchMedia = (key: string, p: Partial<Media>) => setMedia((ms) => ms.map((m) => (m.key === key ? { ...m, ...p } : m)));
  function moveMedia(i: number, d: -1 | 1) {
    setMedia((ms) => { const j = i + d; if (j < 0 || j >= ms.length) return ms; const c = [...ms]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }
  function dropMedia(targetKey: string) {
    setMedia((ms) => {
      const from = ms.findIndex((m) => m.key === dragKey), to = ms.findIndex((m) => m.key === targetKey);
      if (from < 0 || to < 0 || from === to) return ms;
      const c = [...ms]; const [it] = c.splice(from, 1); c.splice(to, 0, it); return c;
    });
    setDragKey(null); setOverKey(null);
  }
  function removeRow(r: Row) {
    if (r.id) patchRow(r.key, { removed: true });
    else setRows((rs) => rs.filter((x) => x.key !== r.key));
  }

  async function upload(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    const room = 20 - media.length;
    if (room <= 0) { toast('A product can have up to 20 images and videos.', 'error'); return; }
    const all = Array.from(files).filter((f) => /^(image\/(jpeg|png|webp|avif)|video\/(mp4|webm))$/.test(f.type));
    if (all.length < files.length) toast('Some files were skipped. Use JPG, PNG, WebP or AVIF images, or MP4 or WebM video.', 'info');
    const picked = all.slice(0, room);
    if (picked.length < all.length) toast(`Only the first ${picked.length} file(s) were uploaded (limit is 20 per product).`, 'info');
    if (!picked.length) return;
    setUploading(true);
    const added: Media[] = [];
    let failed = 0, lastError = '';
    // One file per request: keeps every request under the host's body-size limit, and one bad file never blocks the rest.
    for (let i = 0; i < picked.length; i++) {
      setProgress(`Uploading ${i + 1} of ${picked.length}...`);
      try {
        const f = await compressImage(picked[i]);
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'ERROR', res.status === 413 ? 'That file is too large to upload. Try a smaller file.' : data?.error?.message ?? 'Upload failed.');
        for (const u of data.files as { url: string; kind: 'image' | 'video' }[]) added.push({ key: nextKey(), url: u.url, kind: u.kind, alt: '' });
      } catch (e) {
        failed++; lastError = e instanceof ApiError ? e.message : 'Upload failed. Please try again.';
      }
    }
    if (added.length) { setMedia((ms) => [...ms, ...added]); toast(`${added.length} file${added.length === 1 ? '' : 's'} uploaded.`); }
    if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} failed: ${lastError}`, 'error');
    setUploading(false); setProgress('');
    if (fileRef.current) fileRef.current.value = '';
  }

  /** Mirrors productSchema. Keys match the server's field paths so both sources render in the same place. */
  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a product name.'; else if (name.trim().length > 160) e.name = 'Use 160 characters or fewer.';
    if (slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) e.slug = 'Lowercase letters, numbers and dashes only.';
    if (!categoryId) e.categoryId = 'Choose a category.';
    if (shortDescription.length > 300) e.shortDescription = 'Use 300 characters or fewer.';
    if (description.length > 10000) e.description = 'Use 10,000 characters or fewer.';
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 30) e.tags = 'Use 30 tags or fewer.'; else if (tagList.some((t) => t.length > 40)) e.tags = 'Each tag must be 40 characters or fewer.';
    for (const s of specs) if (s.v.length > 300) e.specs = 'Specification values must be 300 characters or fewer.';
    const intField = (key: string, v: string, max?: number) => {
      if (v.trim() === '') return;
      const n = Number(v);
      if (!Number.isFinite(n) || !isInt(n) || n < 0) e[key] = 'Enter a whole number, 0 or more.';
      else if (max != null && n > max) e[key] = `Maximum is ${max.toLocaleString('en-PH')}.`;
    };
    intField('weightGrams', weight, 100000); intField('lengthMm', length); intField('widthMm', width); intField('heightMm', height);
    if (shippingInfo.length > 1000) e.shippingInfo = 'Use 1,000 characters or fewer.';
    if (seoTitle.length > 120) e.seoTitle = 'Use 120 characters or fewer.';
    if (seoDescription.length > 320) e.seoDescription = 'Use 320 characters or fewer.';
    media.forEach((m, i) => { if (m.alt.length > 200) e[`images.${i}.alt`] = 'Use 200 characters or fewer.'; });
    if (media.length > 20) e.images = 'A product can have up to 20 images and videos.';
    if (activeRows.length < 1) e.variants = 'Add at least one variant.';
    if (activeRows.length > 50) e.variants = 'A product can have up to 50 variants.';
    const seen = new Set<string>();
    activeRows.forEach((r, i) => {
      const p = `variants.${i}.`;
      if (!r.name.trim()) e[p + 'name'] = 'Enter a variant name.'; else if (r.name.trim().length > 80) e[p + 'name'] = 'Use 80 characters or fewer.';
      const sku = r.sku.trim().toUpperCase();
      if (sku.length < 2) e[p + 'sku'] = 'SKU must be at least 2 characters.';
      else if (sku.length > 60) e[p + 'sku'] = 'SKU must be 60 characters or fewer.';
      else if (!/^[A-Z0-9._-]+$/.test(sku)) e[p + 'sku'] = 'SKU: letters, numbers, dot, dash, underscore.';
      else if (seen.has(sku)) e[p + 'sku'] = 'Each variant needs a different SKU.';
      seen.add(sku);
      const money = (key: string, v: string, required: boolean) => {
        if (v.trim() === '') { if (required) e[p + key] = 'Enter an amount.'; return; }
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) e[p + key] = 'Enter an amount of 0 or more.';
        else if (n > MAX_PESOS) e[p + key] = 'Amount is too large.';
      };
      money('priceCentavos', r.price, true); money('compareAtCentavos', r.compareAt, false); money('costCentavos', r.cost, false);
      const th = Number(r.threshold);
      if (r.threshold.trim() === '' || !Number.isFinite(th) || !isInt(th) || th < 0 || th > 10000) e[p + 'lowStockThreshold'] = 'Whole number from 0 to 10,000.';
      if (!r.id) {
        const st = Number(r.initialStock || '0');
        if (!Number.isFinite(st) || !isInt(st) || st < 0 || st > 1_000_000) e[p + 'initialStock'] = 'Whole number, 0 or more.';
      }
    });
    return e;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      setFormError('Please fix the highlighted fields before saving.');
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setFormError(null);
    const imageUrls = new Set(images.map((i) => i.url));
    const body = {
      name: name.trim(),
      ...(slug.trim() ? { slug: slug.trim().toLowerCase() } : {}),
      categoryId,
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      specs: Object.keys(specsObj).length ? specsObj : null,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      status, isFeatured, isLimited,
      weightGrams: numOrNull(weight), lengthMm: numOrNull(length), widthMm: numOrNull(width), heightMm: numOrNull(height),
      shippingInfo: shippingInfo.trim() || null,
      seoTitle: seoTitle.trim() || null, seoDescription: seoDescription.trim() || null,
      ogImageUrl: ogImageUrl && imageUrls.has(ogImageUrl) ? ogImageUrl : null,
      images: media.map((m) => ({ url: m.url, alt: m.alt.trim() || null, kind: m.kind })),
      variants: activeRows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(), sku: r.sku.trim().toUpperCase(), barcode: r.barcode.trim(),
        priceCentavos: toCentavos(r.price), compareAtCentavos: r.compareAt.trim() === '' ? null : toCentavos(r.compareAt), costCentavos: r.cost.trim() === '' ? 0 : toCentavos(r.cost),
        lowStockThreshold: Number(r.threshold), imageUrl: r.imageUrl && imageUrls.has(r.imageUrl) ? r.imageUrl : null, isActive: r.isActive,
        ...(!r.id ? { initialStock: Number(r.initialStock || '0') } : {}),
      })),
    };
    setSaving(true);
    try {
      if (edit) {
        await api(`/api/admin/products/${initial!.id}`, { method: 'PUT', body });
        toast('Product successfully updated.');
        router.refresh();
      } else {
        const r = await api<{ id: string }>('/api/admin/products', { method: 'POST', body });
        toast('Product created.');
        router.push(`/admin/products/${r.id}`);
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fields ?? {});
        setFormError(e.message);
        toast(e.message, 'error');
      } else { setFormError('Something went wrong. Please try again.'); toast('Something went wrong. Please try again.', 'error'); }
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSaving(false);
  }

  const card = 'card p-5';
  const h2 = 'mb-4 font-display text-lg tracking-tightest';
  const otherErrors = Object.entries(errors).filter(([k]) => !SHOWN_INLINE.test(k));

  return (
    <form onSubmit={save} noValidate className="space-y-5 pb-24">
      <div ref={topRef} />
      {edit && initial!.isDemo && (
        <div className="border border-gold bg-gold-soft p-4 text-sm" role="note">
          <strong>Demo product.</strong> This is sample data that came with the demo store. Edit it, archive it, or replace it with your real catalogue before launch.
        </div>
      )}
      {formError && (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <p className="font-semibold">{formError}</p>
          {otherErrors.length > 0 && <ul className="mt-1 list-disc pl-5">{otherErrors.map(([k, m]) => <li key={k}>{m}</li>)}</ul>}
        </div>
      )}

      <section className={card}>
        <h2 className={h2}>Basics</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" error={err('name')} className="md:col-span-2">
            <input className={inputCls(err('name'))} value={name} onChange={(e) => onName(e.target.value)} maxLength={200} placeholder="e.g. Palladium X2 Gen4 Paddle" />
          </Field>
          <Field label="URL slug" error={err('slug')} hint={<>Storefront address: <span className="font-mono">/products/{slug || '...'}</span>{!slugTouched && ' (generated from the name)'}</>}>
            <input className={inputCls(err('slug'))} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-')); }} placeholder="auto-generated" />
          </Field>
          <Field label="Category" error={err('categoryId')}>
            <select className={inputCls(err('categoryId'))} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Status" error={err('status')} hint="Only Active products appear in the store. Draft and Archived are hidden.">
            <select className={inputCls(err('status'))} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Tags" error={err('tags')} hint="Separate with commas, e.g. paddle, gen4, carbon">
            <input className={inputCls(err('tags'))} value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:gap-8">
            <Toggle checked={isFeatured} onChange={setFeatured} label="Featured" hint="Show in featured sections of the store." />
            <Toggle checked={isLimited} onChange={setLimited} label="Limited edition" hint="Marks the product as a limited run." />
          </div>
          <Field label="Short description" error={err('shortDescription')} hint={<Counter value={shortDescription} max={300} />} className="md:col-span-2">
            <textarea className={inputCls(err('shortDescription'))} rows={2} value={shortDescription} onChange={(e) => setShort(e.target.value)} />
          </Field>
          <Field label="Description" error={err('description')} hint={<Counter value={description} max={10000} />} className="md:col-span-2">
            <textarea className={inputCls(err('description'))} rows={7} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Media</h2>
        <p className="mb-3 text-sm text-mute">Drag and drop photos here or use the button. Large photos are resized and compressed automatically. Drag a photo to reorder; the first one is the primary image shown in listings. Up to 20 files (JPG, PNG, WebP, AVIF, MP4 or WebM).</p>
        {err('images') && <p className="field-error mb-2">{err('images')}</p>}
        {media.length > 0 && (
          <ul className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.map((m, i) => (
              <li key={m.key} draggable onDragStart={() => setDragKey(m.key)} onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                onDragOver={(e) => { if (dragKey) { e.preventDefault(); setOverKey(m.key); } }} onDrop={(e) => { if (dragKey) { e.preventDefault(); e.stopPropagation(); dropMedia(m.key); } }}
                className={`cursor-grab border bg-bone p-3 active:cursor-grabbing ${dragKey === m.key ? 'opacity-40' : ''} ${overKey === m.key && dragKey !== m.key ? 'border-gold ring-2 ring-gold' : 'border-line'}`}>
                <div className="relative mb-2 aspect-square overflow-hidden bg-white">
                  {m.kind === 'video'
                    ? <video src={m.url} muted playsInline controls className="h-full w-full object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />}
                  {i === 0 && <span className="absolute left-2 top-2 bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Primary</span>}
                  {m.kind === 'video' && <span className="absolute right-2 top-2 bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Video</span>}
                </div>
                <input className={inputCls(err(`images.${i}.alt`))} value={m.alt} onChange={(e) => patchMedia(m.key, { alt: e.target.value })} placeholder="Alt text (describe the image)" aria-label="Alt text" maxLength={220} />
                {err(`images.${i}.alt`) && <p className="field-error">{err(`images.${i}.alt`)}</p>}
                <div className="mt-2 flex gap-1">
                  <button type="button" className="btn-outline btn-sm flex-1" onClick={() => moveMedia(i, -1)} disabled={i === 0} aria-label="Move earlier">Up</button>
                  <button type="button" className="btn-outline btn-sm flex-1" onClick={() => moveMedia(i, 1)} disabled={i === media.length - 1} aria-label="Move later">Down</button>
                  <button type="button" className="btn-ghost btn-sm text-red-600" onClick={() => setMedia((ms) => ms.filter((x) => x.key !== m.key))}>Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {media[0]?.kind === 'video' && <p className="mb-3 text-xs text-gold-deep">The first item is a video. Move an image to the top so listings have a primary photo.</p>}
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="hidden" onChange={(e) => upload(e.target.files)} />
        <div onDragOver={(e) => { if (!dragKey && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropZone(true); } }} onDragLeave={() => setDropZone(false)}
          onDrop={(e) => { if (!dragKey && e.dataTransfer.files.length) { e.preventDefault(); setDropZone(false); upload(e.dataTransfer.files); } }}
          className={`flex flex-col items-center gap-2 border-2 border-dashed p-6 text-center ${dropZone ? 'border-gold bg-gold-soft' : 'border-line'}`}>
          <p className="text-sm text-mute">{uploading ? progress : 'Drop images here'}</p>
          <button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading || media.length >= 20}>{uploading ? 'Uploading...' : 'Upload images or videos'}</button>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Variants and pricing</h2>
        <p className="mb-4 text-sm text-mute">Each sellable option (size, colour, weight) is a variant with its own SKU, price and stock. Prices are in pesos.</p>
        {err('variants') && <p className="field-error mb-3">{err('variants')}</p>}
        <div className="space-y-4">
          {activeRows.map((r, ai) => {
            const price = Number(r.price), cost = Number(r.cost);
            const showMargin = r.price.trim() !== '' && Number.isFinite(price) && price > 0 && r.cost.trim() !== '' && Number.isFinite(cost) && cost > 0;
            const margin = showMargin ? ((price - cost) / price) * 100 : null;
            const profit = showMargin ? toCentavos(price) - toCentavos(cost) : 0;
            return (
              <div key={r.key} className={`border p-4 ${r.isActive ? 'border-line' : 'border-line bg-bone/70'}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-mute">Variant {ai + 1}{r.id ? '' : ' (new)'}{!r.isActive && ' - inactive'}</div>
                  <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => removeRow(r)} disabled={activeRows.length <= 1}>
                    {r.id ? 'Remove (deactivates)' : 'Remove'}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Variant name" error={verr(ai, 'name')}><input className={inputCls(verr(ai, 'name'))} value={r.name} onChange={(e) => patchRow(r.key, { name: e.target.value })} placeholder="e.g. Blue / 16mm" /></Field>
                  <Field label="SKU" error={verr(ai, 'sku')}><input className={`${inputCls(verr(ai, 'sku'))} font-mono uppercase`} value={r.sku} onChange={(e) => patchRow(r.key, { sku: e.target.value.toUpperCase() })} placeholder="PAL-X2-BLU" /></Field>
                  <Field label="Barcode" error={verr(ai, 'barcode')}><input className={inputCls(verr(ai, 'barcode'))} value={r.barcode} onChange={(e) => patchRow(r.key, { barcode: e.target.value })} placeholder="Optional" /></Field>
                  <Field label="Low-stock alert at" error={verr(ai, 'lowStockThreshold')} hint="Units"><input className={inputCls(verr(ai, 'lowStockThreshold'))} inputMode="numeric" value={r.threshold} onChange={(e) => patchRow(r.key, { threshold: e.target.value })} /></Field>
                  <Field label="Price (PHP)" error={verr(ai, 'priceCentavos')}><input className={inputCls(verr(ai, 'priceCentavos'))} inputMode="decimal" value={r.price} onChange={(e) => patchRow(r.key, { price: e.target.value })} placeholder="0.00" /></Field>
                  <Field label="Compare-at price (PHP)" error={verr(ai, 'compareAtCentavos')} hint="Optional. Shown struck through."><input className={inputCls(verr(ai, 'compareAtCentavos'))} inputMode="decimal" value={r.compareAt} onChange={(e) => patchRow(r.key, { compareAt: e.target.value })} /></Field>
                  <Field label="Cost per item (PHP)" error={verr(ai, 'costCentavos')} hint="Used for margin and inventory value."><input className={inputCls(verr(ai, 'costCentavos'))} inputMode="decimal" value={r.cost} onChange={(e) => patchRow(r.key, { cost: e.target.value })} /></Field>
                  <div>
                    <span className="label">Profit margin</span>
                    <div className="flex h-[42px] items-center border border-dashed border-line bg-bone px-3 text-sm" aria-live="polite">
                      {margin == null ? <span className="text-mute">Enter price and cost</span>
                        : <span className={margin < 0 ? 'font-semibold text-red-600' : 'font-semibold text-emerald-700'}>{margin.toFixed(1)}% <span className="font-normal text-mute">({peso(profit)} per unit)</span></span>}
                    </div>
                  </div>
                  <Field label="Variant image" hint={images.length ? undefined : 'Upload images above to pick one.'}>
                    <select className="input" value={images.some((i) => i.url === r.imageUrl) ? r.imageUrl : ''} onChange={(e) => patchRow(r.key, { imageUrl: e.target.value })}>
                      <option value="">Use product image</option>
                      {images.map((im, n) => <option key={im.key} value={im.url}>{`Image ${media.indexOf(im) + 1}${im.alt ? ` - ${im.alt.slice(0, 30)}` : ''}`}</option>)}
                    </select>
                  </Field>
                  {r.id ? (
                    <div>
                      <span className="label">Current stock</span>
                      <div className="flex h-[42px] items-center justify-between gap-2 border border-line bg-bone px-3 text-sm">
                        <span><strong>{r.onHand ?? 0}</strong> on hand{(r.reserved ?? 0) > 0 && <span className="text-mute">, {r.reserved} reserved</span>}</span>
                        <Link href={`/admin/inventory?q=${encodeURIComponent(r.sku)}`} className="text-xs font-semibold underline">Inventory</Link>
                      </div>
                    </div>
                  ) : (
                    <Field label="Initial stock" error={verr(ai, 'initialStock')} hint="Recorded in the ledger when saved."><input className={inputCls(verr(ai, 'initialStock'))} inputMode="numeric" value={r.initialStock} onChange={(e) => patchRow(r.key, { initialStock: e.target.value })} /></Field>
                  )}
                  <div className="flex items-end pb-2"><Toggle checked={r.isActive} onChange={(v) => patchRow(r.key, { isActive: v })} label="Active" hint="Inactive variants cannot be bought." /></div>
                </div>
              </div>
            );
          })}
        </div>
        {removedRows.length > 0 && (
          <div className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">These variants will be deactivated when you save:</p>
            <p className="text-xs">Variants with orders or stock history are never deleted. They are switched off so they disappear from the store while history stays intact. Their SKUs stay reserved.</p>
            <ul className="mt-2 space-y-1">{removedRows.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2"><span>{r.name} <span className="font-mono text-xs">({r.sku})</span></span><button type="button" className="text-xs font-semibold underline" onClick={() => patchRow(r.key, { removed: false })}>Undo</button></li>
            ))}</ul>
          </div>
        )}
        <button type="button" className="btn-outline btn-sm mt-4" onClick={() => setRows((rs) => [...rs, blankRow()])} disabled={activeRows.length >= 50}>Add variant</button>
      </section>

      <section className={card}>
        <h2 className={h2}>Specifications</h2>
        <p className="mb-3 text-sm text-mute">Shown as a table on the product page, e.g. Core: Polypropylene honeycomb.</p>
        {err('specs') && <p className="field-error mb-2">{err('specs')}</p>}
        <div className="space-y-2">
          {specs.map((s) => (
            <div key={s.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[220px_1fr_auto]">
              <input className="input" value={s.k} onChange={(e) => setSpecs((ss) => ss.map((x) => (x.key === s.key ? { ...x, k: e.target.value } : x)))} placeholder="Name" aria-label="Specification name" />
              <button type="button" className="btn-ghost btn-sm text-red-600 sm:order-3" onClick={() => setSpecs((ss) => ss.filter((x) => x.key !== s.key))} aria-label="Remove specification">Remove</button>
              <input className="input col-span-2 sm:col-span-1" value={s.v} onChange={(e) => setSpecs((ss) => ss.map((x) => (x.key === s.key ? { ...x, v: e.target.value } : x)))} placeholder="Value" aria-label="Specification value" />
            </div>
          ))}
        </div>
        <button type="button" className="btn-outline btn-sm mt-3" onClick={() => setSpecs((ss) => [...ss, { key: nextKey(), k: '', v: '' }])}>Add specification</button>
      </section>

      <section className={card}>
        <h2 className={h2}>Shipping</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Weight (g)" error={err('weightGrams')} hint="Drives weight-based shipping rates."><input className={inputCls(err('weightGrams'))} inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
          <Field label="Length (mm)" error={err('lengthMm')}><input className={inputCls(err('lengthMm'))} inputMode="numeric" value={length} onChange={(e) => setLength(e.target.value)} /></Field>
          <Field label="Width (mm)" error={err('widthMm')}><input className={inputCls(err('widthMm'))} inputMode="numeric" value={width} onChange={(e) => setWidth(e.target.value)} /></Field>
          <Field label="Height (mm)" error={err('heightMm')}><input className={inputCls(err('heightMm'))} inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          <Field label="Shipping information" error={err('shippingInfo')} hint={<Counter value={shippingInfo} max={1000} />} className="sm:col-span-2 lg:col-span-4">
            <textarea className={inputCls(err('shippingInfo'))} rows={3} value={shippingInfo} onChange={(e) => setShippingInfo(e.target.value)} placeholder="Handling notes or delivery details shown on the product page" />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Search engine listing</h2>
        <div className="grid gap-4">
          <Field label="SEO title" error={err('seoTitle')} hint={<><Counter value={seoTitle} max={120} /> Leave blank to use the product name.</>}>
            <input className={inputCls(err('seoTitle'))} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
          </Field>
          <Field label="SEO description" error={err('seoDescription')} hint={<><Counter value={seoDescription} max={320} /> Around 150 to 160 characters works best.</>}>
            <textarea className={inputCls(err('seoDescription'))} rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
          </Field>
          <Field label="Open Graph image" error={err('ogImageUrl')} hint="Shown when the product is shared on social media. Defaults to the first image.">
            <select className="input" value={images.some((i) => i.url === ogImageUrl) ? ogImageUrl : ''} onChange={(e) => setOgImageUrl(e.target.value)}>
              <option value="">First product image</option>
              {images.map((im) => <option key={im.key} value={im.url}>{`Image ${media.indexOf(im) + 1}${im.alt ? ` - ${im.alt.slice(0, 40)}` : ''}`}</option>)}
            </select>
          </Field>
          <div className="border border-line bg-bone p-4" aria-label="Search preview">
            <div className="text-xs text-mute">palladiumpickleball.com/products/{slug || '...'}</div>
            <div className="text-base font-semibold text-blue-700">{seoTitle.trim() || name.trim() || 'Product name'}</div>
            <div className="text-sm text-mute">{seoDescription.trim() || shortDescription.trim() || 'Add a description to control how this page appears in search results.'}</div>
          </div>
        </div>
      </section>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <Link href="/admin/products" className="btn-ghost btn-sm">Back to products</Link>
          <button type="submit" className="btn-primary" disabled={saving || uploading}>{saving ? 'Saving...' : edit ? 'Save changes' : 'Create product'}</button>
        </div>
      </div>
    </form>
  );
}
