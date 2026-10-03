import { route, ok, readJson, clientIp } from '@/lib/api';
import { registerSchema, normalizePhone } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { hashPassword, startSession, throttleStrict, createVerifyToken } from '@/lib/auth';
import { sendVerifyEmail } from '@/lib/email';

export const POST = route(async (req) => {
  await throttleStrict(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const b = registerSchema.parse(await readJson(req));
  const email = b.email.toLowerCase();
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.', { email: 'Already registered. Try signing in.' });
  const user = await prisma.user.create({ data: { email, name: b.name, passwordHash: await hashPassword(b.password), role: 'CUSTOMER' } });
  // Attach to an existing guest customer record with the same email so past orders show up.
  const guest = await prisma.customer.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, userId: null } });
  if (guest) {
    // This email already has a guest record (past orders, addresses). Anyone can type any email, so we only link it, and sign in,
    // after the person proves they own the address by clicking the link we email them.
    try {
      const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      await sendVerifyEmail(user.email, user.name, `${site}/api/auth/verify-email?token=${await createVerifyToken(user)}`);
    } catch (e) { console.error('[register verify email]', e); }
    return ok({ ok: true, verify: true }, 201);
  }
  await prisma.customer.create({ data: { email, name: b.name, phone: b.phone ? normalizePhone(b.phone) : null, userId: user.id, source: b.source ?? null } });
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  return ok({ ok: true }, 201);
});
