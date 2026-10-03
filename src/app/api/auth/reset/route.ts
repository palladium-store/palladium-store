import { route, ok, readJson, clientIp } from '@/lib/api';
import { resetSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { verifyResetToken, hashPassword, throttleStrict } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  await throttleStrict(`reset:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const b = resetSchema.parse(await readJson(req));
  const u = await verifyResetToken(b.token);
  if (!u) throw new AppError(400, 'BAD_TOKEN', 'This reset link is invalid or has expired. Please request a new one.');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(b.password) } });
  return ok({ ok: true });
});
