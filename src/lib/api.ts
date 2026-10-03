import 'server-only';
import { NextResponse } from 'next/server';
import { toAppError, AppError } from './errors';
import { requireStaff } from './auth';
import type { Permission } from './rbac';
import type { SessionUser } from './auth';

export const ok = (data: unknown = { ok: true }, init?: number) => NextResponse.json(data, { status: init ?? 200 });

export function fail(e: unknown) {
  const err = toAppError(e);
  return NextResponse.json({ error: { code: err.code, message: err.message, fields: err.fields } }, { status: err.status });
}

/** CSRF defence in depth (on top of SameSite=Lax cookies): a browser request that changes data must come from our own site. */
function assertSameOrigin(req: Request) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
  const origin = req.headers.get('origin');
  if (!origin) return; // not a browser cross-site request (server-to-server, cron, curl)
  let host = '';
  try { host = new URL(origin).host; } catch { /* handled below */ }
  const site = (() => { try { return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? '').host; } catch { return ''; } })();
  const allowed = [req.headers.get('x-forwarded-host'), req.headers.get('host'), site].filter(Boolean);
  if (!host || !allowed.includes(host)) throw new AppError(403, 'BAD_ORIGIN', 'This request was blocked.');
}
/** Best-effort client IP for rate limiting (first hop of x-forwarded-for, which Vercel sets itself). */
export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? 'ip').split(',')[0].trim();

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new AppError(400, 'BAD_JSON', 'Request body must be valid JSON.'); }
}

/** Public/customer route wrapper: catches errors and returns a consistent JSON shape. */
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => { try { assertSameOrigin(req); return await fn(req, ctx); } catch (e) { return fail(e); } };
}
/** Admin route wrapper: requires a logged-in staff user holding `perm`. */
export function adminRoute<C = unknown>(perm: Permission | null, fn: (req: Request, ctx: C, user: SessionUser) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { assertSameOrigin(req); const user = await requireStaff(perm ?? undefined); return await fn(req, ctx, user); } catch (e) { return fail(e); }
  };
}
export const qs = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);
