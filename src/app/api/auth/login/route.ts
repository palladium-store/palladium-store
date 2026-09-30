import { route, ok, readJson } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { verifyPassword, startSession, throttle, clearThrottle } from '@/lib/auth';
import { isStaff } from '@/lib/rbac';

export const POST = route(async (req) => {
  const b = loginSchema.parse(await readJson(req));
  const key = `login:${b.email.toLowerCase()}:${req.headers.get('x-forwarded-for') ?? 'ip'}`;
  throttle(key);
  const u = await prisma.user.findFirst({ where: { email: { equals: b.email, mode: 'insensitive' } } });
  // Same message for unknown email and wrong password.
  if (!u || !u.isActive || !(await verifyPassword(b.password, u.passwordHash))) throw new AppError(401, 'BAD_CREDENTIALS', 'Incorrect email or password.');
  clearThrottle(key);
  await prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
  await startSession({ id: u.id, email: u.email, name: u.name, role: u.role });
  return ok({ ok: true, redirect: isStaff(u.role) ? '/admin' : '/account' });
});
