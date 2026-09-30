import { adminRoute, ok, readJson } from '@/lib/api';
import { staffSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export const PUT = adminRoute('MANAGE_STAFF', async (req, ctx: { params: { id: string } }, user) => {
  const b = staffSchema.partial({ email: true, name: true }).parse(await readJson(req));
  const target = await prisma.user.findUniqueOrThrow({ where: { id: ctx.params.id } });
  if (target.id === user.id && (b.role && b.role !== target.role || b.isActive === false)) throw new AppError(409, 'SELF_CHANGE', 'You cannot change your own role or deactivate yourself.');
  if (target.role === 'SUPER_ADMIN' && (b.role !== 'SUPER_ADMIN' || b.isActive === false)) {
    const supers = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
    if (supers <= 1) throw new AppError(409, 'LAST_SUPER_ADMIN', 'There must be at least one active Super Admin.');
  }
  await prisma.user.update({ where: { id: target.id }, data: { ...(b.name ? { name: b.name } : {}), ...(b.role ? { role: b.role } : {}), ...(b.isActive !== undefined ? { isActive: b.isActive } : {}), ...(b.password ? { passwordHash: await hashPassword(b.password) } : {}) } });
  await audit(user, 'STAFF_UPDATED', 'User', target.id, `Updated staff account ${target.name}${b.role ? ` (role ${b.role})` : ''}${b.isActive === false ? ' (deactivated)' : ''}`);
  return ok();
});
