'use client';
import { useRef, useState } from 'react';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Field, inputCls } from './Field';

export interface ContentData {
  hero: { eyebrow: string; title: string; subtitle: string; cta: string; image: string };
  banners: { title: string; text: string; href: string; cta: string }[];
  brandStory: { title: string; body: string };
  announcement: string;
  policies: { slug: string; title: string; body: string }[];
}
interface Keyed<T> { key: number; v: T }
let seq = 0;
const wrap = <T,>(arr: T[]): Keyed<T>[] => arr.map((v) => ({ key: ++seq, v }));
const SLUG = /^[a-z0-9-]+$/;

function Counter({ value, max }: { value: string; max: number }) { return <span className={value.length > max ? 'text-red-600' : ''}>{value.length}/{max}</span>; }

export function ContentEditor({ initial }: { initial: ContentData }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hero, setHero] = useState(initial.hero);
  const [announcement, setAnnouncement] = useState(initial.announcement);
  const [banners, setBanners] = useState(() => wrap(initial.banners));
  const [story, setStory] = useState(initial.brandStory);
  const [policies, setPolicies] = useState(() => wrap(initial.policies));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const err = (k: string) => errors[k];

  async function uploadHero(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Upload failed.');
      const file = (data.files as { url: string; kind: string }[])[0];
      if (file.kind !== 'image') throw new ApiError(422, 'BAD_FILE', 'The hero must be an image, not a video.');
      setHero((h) => ({ ...h, image: file.url }));
      toast('Image uploaded. Save to publish it.');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Upload failed. Please try again.', 'error'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!hero.title.trim()) e['hero.title'] = 'Enter a headline.';
    if (hero.title.length > 120) e['hero.title'] = 'Use 120 characters or fewer.';
    if (hero.eyebrow.length > 120) e['hero.eyebrow'] = 'Use 120 characters or fewer.';
    if (hero.subtitle.length > 300) e['hero.subtitle'] = 'Use 300 characters or fewer.';
    if (hero.cta.length > 40) e['hero.cta'] = 'Use 40 characters or fewer.';
    if (hero.image.length > 500) e['hero.image'] = 'Use 500 characters or fewer.';
    if (announcement.length > 160) e.announcement = 'Use 160 characters or fewer.';
    banners.forEach(({ v }, i) => {
      if (v.title.length > 80) e[`banners.${i}.title`] = 'Use 80 characters or fewer.';
      if (v.text.length > 200) e[`banners.${i}.text`] = 'Use 200 characters or fewer.';
      if (v.href.length > 200) e[`banners.${i}.href`] = 'Use 200 characters or fewer.';
      if (v.cta.length > 40) e[`banners.${i}.cta`] = 'Use 40 characters or fewer.';
    });
    if (story.title.length > 140) e['brandStory.title'] = 'Use 140 characters or fewer.';
    if (story.body.length > 3000) e['brandStory.body'] = 'Use 3,000 characters or fewer.';
    const seen = new Set<string>();
    policies.forEach(({ v }, i) => {
      if (!SLUG.test(v.slug)) e[`policies.${i}.slug`] = 'Lowercase letters, numbers and dashes only.';
      else if (seen.has(v.slug)) e[`policies.${i}.slug`] = 'Each page needs a different slug.';
      seen.add(v.slug);
      if (v.title.length > 80) e[`policies.${i}.title`] = 'Use 80 characters or fewer.';
      if (!v.title.trim()) e[`policies.${i}.title`] = 'Enter a page title.';
      if (v.body.length > 10000) e[`policies.${i}.body`] = 'Use 10,000 characters or fewer.';
    });
    return e;
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) { setFormError('Please fix the highlighted fields before saving.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setFormError(null); setSaving(true);
    try {
      await api('/api/admin/settings/content', { method: 'PUT', body: { hero, banners: banners.map((b) => b.v), brandStory: story, announcement, policies: policies.map((p) => p.v) } });
      toast('Content saved.');
    } catch (e) {
      if (e instanceof ApiError) { setErrors(e.fields ?? {}); setFormError(e.message); toast(e.message, 'error'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else toast('Something went wrong. Please try again.', 'error');
    }
    setSaving(false);
  }

  const card = 'card p-5';
  const h2 = 'mb-4 font-display text-lg tracking-tightest';
  const patchBanner = (key: number, p: Partial<ContentData['banners'][number]>) => setBanners((bs) => bs.map((b) => (b.key === key ? { ...b, v: { ...b.v, ...p } } : b)));
  const patchPolicy = (key: number, p: Partial<ContentData['policies'][number]>) => setPolicies((ps) => ps.map((x) => (x.key === key ? { ...x, v: { ...x.v, ...p } } : x)));

  return (
    <form onSubmit={save} noValidate className="space-y-5 pb-24">
      {formError && <div className="border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">{formError}</div>}

      <section className={card}>
        <h2 className={h2}>Announcement bar</h2>
        <Field label="Announcement text" error={err('announcement')} hint={<>Shown across the top of every storefront page. Leave blank to hide. <Counter value={announcement} max={160} /></>}>
          <input className={inputCls(err('announcement'))} value={announcement} onChange={(e) => setAnnouncement(e.target.value)} />
        </Field>
      </section>

      <section className={card}>
        <h2 className={h2}>Homepage hero</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Eyebrow" error={err('hero.eyebrow')} hint="Small line above the headline."><input className={inputCls(err('hero.eyebrow'))} value={hero.eyebrow} onChange={(e) => setHero({ ...hero, eyebrow: e.target.value })} /></Field>
          <Field label="Headline" error={err('hero.title')}><input className={inputCls(err('hero.title'))} value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} /></Field>
          <Field label="Subtitle" error={err('hero.subtitle')} hint={<Counter value={hero.subtitle} max={300} />} className="md:col-span-2"><textarea className={inputCls(err('hero.subtitle'))} rows={2} value={hero.subtitle} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} /></Field>
          <Field label="Button text" error={err('hero.cta')}><input className={inputCls(err('hero.cta'))} value={hero.cta} onChange={(e) => setHero({ ...hero, cta: e.target.value })} /></Field>
          <Field label="Hero image URL" error={err('hero.image')} hint="Paste an image address or upload a file.">
            <div className="flex gap-2">
              <input className={inputCls(err('hero.image'))} value={hero.image} onChange={(e) => setHero({ ...hero, image: e.target.value })} placeholder="/products/x2-blue.webp" />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => uploadHero(e.target.files)} />
              <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </Field>
          {hero.image && (
            <div className="md:col-span-2">
              <span className="label">Preview</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero.image} alt="Hero preview" className="h-40 w-full max-w-md border border-line bg-bone object-cover" />
            </div>
          )}
        </div>
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-lg tracking-tightest">Promo banners ({banners.length}/4)</h2>
          <button type="button" className="btn-outline btn-sm" disabled={banners.length >= 4} onClick={() => setBanners((b) => [...b, ...wrap([{ title: '', text: '', href: '/shop', cta: 'Shop now' }])])}>Add banner</button></div>
        {banners.length === 0 && <p className="text-sm text-mute">No banners. Add up to four promotional banners for the homepage.</p>}
        <div className="space-y-4">
          {banners.map((b, i) => (
            <div key={b.key} className="border border-line p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-mute">Banner {i + 1}</span>
                <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => setBanners((bs) => bs.filter((x) => x.key !== b.key))}>Remove</button></div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Title" error={err(`banners.${i}.title`)}><input className={inputCls(err(`banners.${i}.title`))} value={b.v.title} onChange={(e) => patchBanner(b.key, { title: e.target.value })} /></Field>
                <Field label="Link" error={err(`banners.${i}.href`)} hint="A page address such as /shop"><input className={inputCls(err(`banners.${i}.href`))} value={b.v.href} onChange={(e) => patchBanner(b.key, { href: e.target.value })} /></Field>
                <Field label="Text" error={err(`banners.${i}.text`)} hint={<Counter value={b.v.text} max={200} />}><textarea className={inputCls(err(`banners.${i}.text`))} rows={2} value={b.v.text} onChange={(e) => patchBanner(b.key, { text: e.target.value })} /></Field>
                <Field label="Button text" error={err(`banners.${i}.cta`)}><input className={inputCls(err(`banners.${i}.cta`))} value={b.v.cta} onChange={(e) => patchBanner(b.key, { cta: e.target.value })} /></Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className={h2}>Brand story</h2>
        <div className="grid gap-4">
          <Field label="Title" error={err('brandStory.title')}><input className={inputCls(err('brandStory.title'))} value={story.title} onChange={(e) => setStory({ ...story, title: e.target.value })} /></Field>
          <Field label="Story" error={err('brandStory.body')} hint={<Counter value={story.body} max={3000} />}><textarea className={inputCls(err('brandStory.body'))} rows={6} value={story.body} onChange={(e) => setStory({ ...story, body: e.target.value })} /></Field>
        </div>
      </section>

      <section className={card}>
        <div className="mb-2 flex items-center justify-between gap-3"><h2 className="font-display text-lg tracking-tightest">Policy pages ({policies.length}/12)</h2>
          <button type="button" className="btn-outline btn-sm" disabled={policies.length >= 12} onClick={() => setPolicies((p) => [...p, ...wrap([{ slug: '', title: '', body: '' }])])}>Add page</button></div>
        <p className="mb-4 text-sm text-mute">Each page is available at /pages/&lt;slug&gt; on the storefront and is linked from the footer. Changing a slug changes its address.</p>
        <div className="space-y-4">
          {policies.map((p, i) => (
            <div key={p.key} className="border border-line p-4">
              <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-mute">Page {i + 1}</span>
                <button type="button" className="text-xs font-semibold text-red-600 underline" onClick={() => setPolicies((ps) => ps.filter((x) => x.key !== p.key))}>Remove</button></div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Slug" error={err(`policies.${i}.slug`)}><input className={`${inputCls(err(`policies.${i}.slug`))} font-mono`} value={p.v.slug} onChange={(e) => patchPolicy(p.key, { slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="shipping" /></Field>
                <Field label="Title" error={err(`policies.${i}.title`)}><input className={inputCls(err(`policies.${i}.title`))} value={p.v.title} onChange={(e) => patchPolicy(p.key, { title: e.target.value })} /></Field>
                <Field label="Body" error={err(`policies.${i}.body`)} hint={<Counter value={p.v.body} max={10000} />} className="md:col-span-2"><textarea className={inputCls(err(`policies.${i}.body`))} rows={6} value={p.v.body} onChange={(e) => patchPolicy(p.key, { body: e.target.value })} /></Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] justify-end"><button type="submit" className="btn-primary" aria-busy={saving} disabled={saving || uploading}>{saving ? 'Saving...' : 'Save content'}</button></div>
      </div>
    </form>
  );
}
