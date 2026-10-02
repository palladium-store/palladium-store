'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { EmptyState } from '@/components/ui/bits';
import { Field, inputCls } from './Field';

export interface CategoryRow { id: string; name: string; slug: string; parentId: string | null; parentName: string; sortOrder: number; products: number; children: number }
interface Form { name: string; slug: string; parentId: string; sortOrder: string }
const emptyForm = (): Form => ({ name: '', slug: '', parentId: '', sortOrder: '0' });
const slugOf = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);

export function CategoryManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<CategoryRow | null>(null);
  const closeEditor = useCallback(() => { if (!busy) setEditing(null); }, [busy]);
  const closeDelete = useCallback(() => { if (!busy) setDel(null); }, [busy]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() { setForm(emptyForm()); setSlugTouched(false); setErrors({}); setFormError(null); setEditing('new'); }
  function openEdit(r: CategoryRow) { setForm({ name: r.name, slug: r.slug, parentId: r.parentId ?? '', sortOrder: String(r.sortOrder) }); setSlugTouched(true); setErrors({}); setFormError(null); setEditing(r); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!form.name.trim()) v.name = 'Enter a name.'; else if (form.name.trim().length > 60) v.name = 'Use 60 characters or fewer.';
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) v.slug = 'Use lowercase letters, numbers and dashes.';
    const so = Number(form.sortOrder);
    if (form.sortOrder.trim() === '' || !Number.isInteger(so) || so < 0 || so > 10000) v.sortOrder = 'Whole number from 0 to 10,000.';
    setErrors(v);
    if (Object.keys(v).length) { setFormError('Please fix the highlighted fields.'); return; }
    setFormError(null); setBusy(true);
    const body = { name: form.name.trim(), slug: form.slug, parentId: form.parentId || null, sortOrder: so };
    try {
      if (editing === 'new') { await api('/api/admin/categories', { method: 'POST', body }); toast('Category created.'); }
      else if (editing) { await api(`/api/admin/categories/${editing.id}`, { method: 'PUT', body }); toast('Category updated.'); }
      setEditing(null);
      router.refresh();
    } catch (er) {
      if (er instanceof ApiError) { setErrors(er.fields ?? {}); setFormError(er.message); } else setFormError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }
  async function remove() {
    if (!del) return;
    setBusy(true);
    try { await api(`/api/admin/categories/${del.id}`, { method: 'DELETE' }); toast(`${del.name} deleted.`); setDel(null); router.refresh(); }
    catch (er) { toast(er instanceof ApiError ? er.message : 'Could not delete the category.', 'error'); setDel(null); }
    setBusy(false);
  }

  const selfId = editing && editing !== 'new' ? editing.id : null;
  const parentOptions = rows.filter((r) => !r.parentId && r.id !== selfId);
  const btn = 'border border-line px-2 py-1 text-[11px] font-semibold hover:bg-ink hover:text-white';
  const ordered = [...rows.filter((r) => !r.parentId).flatMap((p) => [p, ...rows.filter((c) => c.parentId === p.id)]), ...rows.filter((r) => r.parentId && !rows.some((p) => p.id === r.parentId))];

  return (
    <>
      <div className="mb-4 flex justify-end"><button className="btn-primary btn-sm" onClick={openNew}>Add category</button></div>
      {rows.length === 0 ? <EmptyState title="No categories yet" text="Add a category such as Paddles or Grip Tape, then assign products to it." action={<button className="btn-primary btn-sm" onClick={openNew}>Add category</button>} />
        : (
          <div className="table-wrap">
            <table className="tbl min-w-[640px]">
              <thead><tr><th>Name</th><th>URL</th><th>Parent</th><th className="text-right">Order</th><th className="text-right">Products</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {ordered.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.parentId ? <span className="pl-4 text-mute">- </span> : null}{r.name}</td>
                    <td className="font-mono text-xs">/shop?category={r.slug}</td>
                    <td className="text-sm">{r.parentName || '-'}</td>
                    <td className="text-right tabular-nums">{r.sortOrder}</td>
                    <td className="text-right tabular-nums">{r.products}</td>
                    <td><div className="flex justify-end gap-1">
                      <button className={btn} onClick={() => openEdit(r)}>Edit</button>
                      <button className={`${btn} text-red-600 hover:bg-red-600`} onClick={() => setDel(r)}>Delete</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Modal open={!!editing} onClose={closeEditor} title={editing === 'new' ? 'Add category' : 'Edit category'}>
        <form onSubmit={save} noValidate className="space-y-4">
          {formError && <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</div>}
          <Field label="Name" error={errors.name}>
            <input className={inputCls(errors.name)} value={form.name} autoFocus placeholder="e.g. Grip Tape"
              onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugOf(name) })); }} />
          </Field>
          <Field label="URL name" error={errors.slug} hint="Used in the store address. Filled in automatically from the name.">
            <input className={`${inputCls(errors.slug)} font-mono`} value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }} />
          </Field>
          <Field label="Parent category" error={errors.parentId} hint="Optional. Categories can be nested one level deep.">
            <select className="input" value={form.parentId} onChange={(e) => set('parentId', e.target.value)}>
              <option value="">None (top level)</option>
              {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Display order" error={errors.sortOrder} hint="Lower numbers appear first.">
            <input className={inputCls(errors.sortOrder)} inputMode="numeric" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost btn-sm" onClick={closeEditor} disabled={busy}>Cancel</button>
            <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving...' : 'Save category'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!del} onClose={closeDelete} title="Delete category?" danger busy={busy} confirmLabel="Delete category" onConfirm={remove}
        message={del ? (del.products || del.children ? <>This category cannot be deleted while it still has {del.products ? `${del.products} product${del.products === 1 ? '' : 's'}` : ''}{del.products && del.children ? ' and ' : ''}{del.children ? `${del.children} sub-categor${del.children === 1 ? 'y' : 'ies'}` : ''}. Move them first.</> : <>Delete <strong>{del.name}</strong>? This cannot be undone.</>) : null} />
    </>
  );
}
