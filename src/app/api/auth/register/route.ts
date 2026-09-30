import { route, ok, readJson } from '@/lib/api';
import { registerSchema, normalizePhone } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { hashPassword, startSession, throttle } from '@/lib/auth';

export const POST = route(async (req) => {
  throttle(`register:${req.headers.get('x-forwarded-for') ?? 'ip'}`, 10);
  const b = registerSchema.parse(await readJson(req));
  const email = b.email.toLowerCase();
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.', { email: 'Already registered. Try signing in.' });
  const user = await prisma.user.create({ data: { email, name: b.name, passwordHash: await hashPassword(b.password), role: 'CUSTOMER' } });
  // Attach to an existing guest customer record with the same email so past orders show up.
  const guest = await prisma.customer.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, userId: null } });
  if (guest) await prisma.customer.update({ where: { id: guest.id }, data: { userId: user.id, name: b.name, phone: b.phone ? normalizePhone(b.phone) : guest.phone } });
  else await prisma.customer.create({ data: { email, name: b.name, phone: b.phone ? normalizePhone(b.phone) : null, userId: user.id, source: b.source ?? null } });
  await startSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  return ok({ ok: true }, 201);
});
