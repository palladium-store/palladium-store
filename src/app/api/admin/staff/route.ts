import { adminRoute, ok, readJson } from '@/lib/api';
import { staffSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export const POST = adminRoute('MANAGE_STAFF', async (req, _c, user) => {
  const b = staffSchema.parse(await readJson(req));
  if (!b.password) throw new AppError(422, 'VALIDATION', 'Set a password for the new user.', { password: 'Required.' });
  if (await prisma.user.findFirst({ where: { email: { equals: b.email, mode: 'insensitive' } } })) throw new AppError(409, 'DUPLICATE', 'A user with this email already exists.', { email: 'Already in use.' });
  const u = await prisma.user.create({ data: { email: b.email.toLowerCase(), name: b.name, role: b.role, passwordHash: await hashPassword(b.password) } });
  await audit(user, 'STAFF_CREATED', 'User', u.id, `Created ${b.role} account for ${b.name}`);
  return ok({ id: u.id }, 201);
});
