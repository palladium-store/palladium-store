import { route, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const body = z.object({ sessionId: z.string().min(8).max(64), path: z.string().max(300), referrer: z.string().max(300).optional(), source: z.string().max(60).optional() });
export const POST = route(async (req) => {
  const b = body.safeParse(await readJson(req).catch(() => ({})));
  if (b.success && !b.data.path.startsWith('/admin')) await prisma.siteVisit.create({ data: b.data });
  return ok();
});
