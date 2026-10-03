import { route, ok, readJson, clientIp } from '@/lib/api';
import { forgotSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';
import { throttleStrict, createResetToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const b = forgotSchema.parse(await readJson(req));
  await throttleStrict(`forgot:${b.email.toLowerCase()}:${clientIp(req)}`, 4, 60 * 60 * 1000);
  const u = await prisma.user.findFirst({ where: { email: { equals: b.email, mode: 'insensitive' } } });
  if (u && u.isActive) {
    try {
      const token = await createResetToken(u);
      const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
      await sendPasswordResetEmail(u.email, u.name, `${site}/reset-password?token=${token}`);
    } catch (e) { console.error('[forgot-password]', e); }
  }
  // Same response whether or not the email exists.
  return ok({ ok: true });
});
