import { route, ok, readJson } from '@/lib/api';
import { newsletterSchema } from '@/lib/validators';
import { prisma } from '@/lib/db';

export const POST = route(async (req) => {
  const { email } = newsletterSchema.parse(await readJson(req));
  await prisma.newsletterSubscriber.upsert({ where: { email: email.toLowerCase() }, create: { email: email.toLowerCase() }, update: {} });
  return ok({ ok: true }, 201);
});
