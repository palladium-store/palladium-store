import { route, ok, readJson } from '@/lib/api';
import { loginSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { verifyPassword, startSession, throttleStrict, clearStrict, createVerifyToken } from '@/lib/auth';
import { sendVerifyEmail } from '@/lib/email';
import { isStaff } from '@/lib/rbac';

// Compared against when the email is unknown, so response time does not reveal which emails have accounts.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5e4m5tHq9n0h1Qm0bJ9H8nQZ7kYk9oS';

export const POST = route(async (req) => {
  const b = loginSchema.parse(await readJson(req));
  const key = `login:${b.email.toLowerCase()}:${req.headers.get('x-forwarded-for') ?? 'ip'}`;
  await throttleStrict(key);
  const u = await prisma.user.findFirst({ where: { email: { equals: b.email, mode: 'insensitive' } } });
  // Same message for unknown email and wrong password.
  const passwordOk = await verifyPassword(b.password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !u.isActive || !passwordOk) throw new AppError(401, 'BAD_CREDENTIALS', 'Incorrect email or password.');
  await clearStrict(key);
  if (u.role === 'CUSTOMER' && !(await prisma.customer.findUnique({ where: { userId: u.id }, select: { id: true } }))) {
    const guest = await prisma.customer.findFirst({ where: { email: { equals: u.email, mode: 'insensitive' } } });
    if (guest) {
      // Account exists but was never confirmed against an existing guest record: ask for email confirmation first.
      try {
        const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
        await sendVerifyEmail(u.email, u.name, `${site}/api/auth/verify-email?token=${await createVerifyToken(u)}`);
      } catch (e) { console.error('[login verify email]', e); }
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please confirm your email first. We just sent you a new confirmation link.');
    }
    await prisma.customer.create({ data: { email: u.email.toLowerCase(), name: u.name, userId: u.id } });
  }
  await prisma.user.update({ where: { id: u.id }, data: { lastLoginAt: new Date() } });
  await startSession({ id: u.id, email: u.email, name: u.name, role: u.role });
  return ok({ ok: true, redirect: isStaff(u.role) ? '/admin' : '/' });
});
