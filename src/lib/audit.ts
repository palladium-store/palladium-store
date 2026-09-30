import 'server-only';
import { prisma } from './db';
import type { SessionUser } from './auth';
import type { Prisma } from '@prisma/client';

/** Records an admin action that affects business data. Never throws into the caller's flow. */
export async function audit(user: Pick<SessionUser, 'id' | 'name'> | null, action: string, entity: string, entityId: string | null, summary: string, metadata?: Prisma.InputJsonValue) {
  try {
    await prisma.adminActivityLog.create({ data: { userId: user?.id ?? null, userName: user?.name ?? 'System', action, entity, entityId, summary, metadata } });
  } catch (e) { console.error('[audit] failed', e); }
}
