import { adminRoute, ok, readJson } from '@/lib/api';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const GET = adminRoute(null, async () => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { audience: 'ADMIN' }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.notification.count({ where: { audience: 'ADMIN', isRead: false } }),
  ]);
  return ok({ items, unread });
});
export const POST = adminRoute(null, async (req) => {
  const b = z.object({ ids: z.array(z.string()).optional() }).parse(await readJson(req));
  await prisma.notification.updateMany({ where: { audience: 'ADMIN', isRead: false, ...(b.ids ? { id: { in: b.ids } } : {}) }, data: { isRead: true } });
  return ok();
});
