import { PrismaClient } from '@prisma/client';

/** Tolerates a pasted value with stray spaces, quotes or a leading `DATABASE_URL=` (common when typing env vars in a host dashboard). */
function cleanUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let v = raw.trim().replace(/^DATABASE_URL\s*=\s*/i, '').trim();
  v = v.replace(/^["'`]+/, '').replace(/["'`]+$/, '').trim();
  return v || undefined;
}

/**
 * Supabase's pooler allows only a handful of connections in total (15 in session mode). Each serverless instance would otherwise open
 * several, and a few busy instances use them all up ("max clients reached"). Unless the address already sets a limit, allow 2 per instance.
 */
function withPoolLimit(u: string | undefined): string | undefined {
  if (!u || /connection_limit=/i.test(u) || !/pooler\.supabase\.com/i.test(u)) return u;
  return `${u}${u.includes('?') ? '&' : '?'}connection_limit=2`;
}

/** The store's tables live in the "palladium" schema on Supabase. Supabase's copy-paste address has no schema, which makes Prisma look in "public". */
function withSchema(u: string | undefined): string | undefined {
  if (!u || /[?&]schema=/i.test(u) || !/supabase\.(com|co)/i.test(u)) return u;
  return `${u}${u.includes('?') ? '&' : '?'}schema=palladium`;
}

const url = withPoolLimit(withSchema(cleanUrl(process.env.DATABASE_URL)));
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
