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

export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new AppError(400, 'BAD_JSON', 'Request body must be valid JSON.'); }
}

/** Public/customer route wrapper: catches errors and returns a consistent JSON shape. */
export function route<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => { try { return await fn(req, ctx); } catch (e) { return fail(e); } };
}
/** Admin route wrapper: requires a logged-in staff user holding `perm`. */
export function adminRoute<C = unknown>(perm: Permission | null, fn: (req: Request, ctx: C, user: SessionUser) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try { const user = await requireStaff(perm ?? undefined); return await fn(req, ctx, user); } catch (e) { return fail(e); }
  };
}
export const qs = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);
