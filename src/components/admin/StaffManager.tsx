'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/components/ui/api-client';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/bits';
import { ROLE_LABELS, ROLE_PERMISSIONS, STAFF_ROLES, type Permission } from '@/lib/rbac';
import { Field, Toggle, inputCls } from './Field';

export interface StaffRow { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginLabel: string; isSelf: boolean }
type RoleKey = (typeof STAFF_ROLES)[number];

const PERMS: { key: Permission; label: string; help: string }[] = [
  { key: 'VIEW_ORDERS', label: 'View orders', help: 'See orders and order details' },
  { key: 'EDIT_ORDERS', label: 'Manage orders', help: 'Confirm payments, ship, cancel and refund' },
  { key: 'MANAGE_PRODUCTS', label: 'Manage products', help: 'Create, edit, archive and delete products' },
  { key: 'MANAGE_INVENTORY', label: 'Manage inventory', help: 'Receive, adjust and transfer stock' },
  { key: 'VIEW_CUSTOMERS', label: 'View customers', help: 'See customer profiles and history' },
  { key: 'VIEW_REPORTS', label: 'View reports', help: 'Reports and analytics' },
  { key: 'MANAGE_DISCOUNTS', label: 'Discounts and marketing', help: 'Discount codes, subscribers, review moderation' },
  { key: 'MANAGE_SETTINGS', label: 'Settings and content', help: 'Store settings, payments, shipping, content, overselling' },
  { key: 'MANAGE_STAFF', label: 'Manage staff', help: 'Create staff and change roles' },
  { key: 'VIEW_AUDIT', label: 'View activity log', help: 'Audit trail of admin actions' },
];
const pwOk = (p: string) => p.length >= 8 && p.length <= 100 && /[A-Za-z]/.test(p) && /\d/.test(p);

export function StaffManager({ staff, activeSuperAdmins }: { staff: StaffRow[]; activeSuperAdmins: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<'create' | StaffRow | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleKey>('STAFF');
  const [isActive, setActive] = useState(true);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeModal = useCallback(() => { if (!busy) setMode(null); }, [busy]);
  function openCreate() { setName(''); setEmail(''); setRole('STAFF'); setActive(true); setPassword(''); setErrors({}); setFormError(null); setMode('create'); }
  function openEdit(s: StaffRow) { setName(s.name); setEmail(s.email); setRole(s.role as RoleKey); setActive(s.isActive); setPassword(''); setErrors({}); setFormError(null); setMode(s); }
  const editing = mode && mode !== 'create' ? mode : null;
  const lastSuper = !!editing && editing.role === 'SUPER_ADMIN' && editing.isActive && activeSuperAdmins <= 1;
  const lockRole = !!editing && (editing.isSelf || lastSuper);
  const lockActive = !!editing && (editing.isSelf || lastSuper);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (name.trim().length < 2) v.name = 'Enter a full name.';
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) v.email = 'Enter a valid email address.';
    if (!editing && !password) v.password = 'Set a password for the new user.';
    if (password && !pwOk(password)) v.password = 'Use 8+ characters with a letter and a number.';
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true); setFormError(null);
    try {
      if (editing) {
        await api(`/api/admin/staff/${editing.id}`, { method: 'PUT', body: { name: name.trim(), role, isActive, ...(password ? { password } : {}) } });
        toast(password ? 'Staff account updated and password reset.' : 'Staff account updated.');
      } else {
        await api('/api/admin/staff', { method: 'POST', body: { name: name.trim(), email: email.trim(), role, password } });
        toast('Staff account created.');
      }
      setMode(null);
      router.refresh();
    } catch (er) {
      if (er instanceof ApiError) { setErrors(er.fields ?? {}); setFormError(er.message); } else setFormError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg tracking-tightest">Team members</h2>
          <div className="flex gap-2"><Link href="/admin/activity" className="btn-outline btn-sm">Activity log</Link><button className="btn-primary btn-sm" onClick={openCreate}>Add staff</button></div>
        </div>
        <div className="table-wrap">
          <table className="tbl min-w-[720px]">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold">{s.name}{s.isSelf && <span className="ml-2 text-xs font-normal text-mute">(you)</span>}</td>
                  <td>{s.email}</td>
                  <td>{ROLE_LABELS[s.role as RoleKey] ?? s.role}</td>
                  <td><Badge status={s.isActive ? 'ACTIVE' : 'DRAFT'} label={s.isActive ? 'Active' : 'Inactive'} /></td>
                  <td className="whitespace-nowrap text-xs text-mute">{s.lastLoginLabel}</td>
                  <td className="text-right"><button className="border border-line px-2 py-1 text-[11px] font-semibold hover:bg-ink hover:text-white" onClick={() => openEdit(s)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc pl-5 text-xs text-mute">
          <li>You cannot change your own role or deactivate yourself.</li>
          <li>There must always be at least one active Super Admin.</li>
          <li>Deactivated users lose access immediately. Resetting a password does not sign the user out of existing sessions.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg tracking-tightest">Roles and permissions</h2>
        <div className="table-wrap">
          <table className="tbl min-w-[760px]">
            <thead><tr><th>Permission</th>{STAFF_ROLES.map((r) => <th key={r} className="text-center">{ROLE_LABELS[r]}</th>)}</tr></thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.key}>
                  <td><div className="font-semibold">{p.label}</div><div className="text-xs text-mute">{p.help}</div></td>
                  {STAFF_ROLES.map((r) => {
                    const has = ROLE_PERMISSIONS[r].includes(p.key);
                    return <td key={r} className="text-center">{has ? <span className="font-bold text-emerald-700" aria-label="Allowed">&#10003;</span> : <span className="text-neutral-300" aria-label="Not allowed">&ndash;</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={!!mode} onClose={closeModal} title={editing ? `Edit ${editing.name}` : 'Add staff member'}>
        <form onSubmit={submit} noValidate className="space-y-4">
          {formError && <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</div>}
          <Field label="Full name" error={errors.name}><input className={inputCls(errors.name)} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label="Email" error={errors.email} hint={editing ? 'Email cannot be changed.' : 'Used to sign in.'}><input type="email" className={inputCls(errors.email)} value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editing} /></Field>
          <Field label="Role" error={errors.role} hint={lockRole ? (editing?.isSelf ? 'You cannot change your own role.' : 'This is the only active Super Admin.') : undefined}>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as RoleKey)} disabled={lockRole}>{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
          </Field>
          {editing && <Toggle checked={isActive} onChange={setActive} disabled={lockActive} label="Active" hint={lockActive ? (editing.isSelf ? 'You cannot deactivate yourself.' : 'The last Super Admin cannot be deactivated.') : 'Inactive users cannot sign in.'} />}
          <Field label={editing ? 'Reset password (optional)' : 'Password'} error={errors.password} hint="At least 8 characters with a letter and a number. Share it with the user securely.">
            <input type="text" autoComplete="new-password" className={inputCls(errors.password)} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={editing ? 'Leave blank to keep the current password' : ''} />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setMode(null)} disabled={busy}>Cancel</button>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Create account'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
