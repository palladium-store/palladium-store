import { route, ok, readJson } from '@/lib/api';
import { requireUser, verifyPassword, hashPassword, startSession, throttle } from '@/lib/auth';
import { changePasswordSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';

export const POST = route(async (req) => {
  const user = await requireUser();
  throttle(`pwchange:${user.id}`, 8);
  const b = changePasswordSchema.parse(await readJson(req));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(b.current, u.passwordHash))) throw new AppError(422, 'BAD_PASSWORD', 'Current password is incorrect.', { current: 'Incorrect password.' });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(b.next) } });
  await startSession(user); // all other sessions end; this one continues
  return ok();
});
