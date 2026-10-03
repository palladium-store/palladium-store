import { route, ok, readJson, clientIp } from '@/lib/api';
import { throttle } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const body = z.object({ sessionId: z.string().min(8).max(64), path: z.string().max(300), referrer: z.string().max(300).optional(), source: z.string().max(60).optional() });
export const POST = route(async (req) => {
  throttle(`track:${clientIp(req)}`, 120, 10 * 60 * 1000);
  const b = body.safeParse(await readJson(req).catch(() => ({})));
  if (b.success && !b.data.path.startsWith('/admin')) await prisma.siteVisit.create({ data: b.data });
  return ok();
});
