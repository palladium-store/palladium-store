import { PrismaClient } from '@prisma/client';

/** Tolerates a pasted value with stray spaces, quotes or a leading `DATABASE_URL=` (common when typing env vars in a host dashboard). */
function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim().replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  v = v.replace(/^["'`]+/, '').replace(/["'`]+$/, '').trim();
  return v || undefined;
}

const url = cleanUrl(process.env.DATABASE_URL);
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
