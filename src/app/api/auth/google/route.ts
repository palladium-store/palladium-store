import { NextResponse } from 'next/server';
import { googleEnabled, newFlow, authUrl, GOOGLE_COOKIE } from '@/lib/google-oauth';
import { throttle } from '@/lib/auth';
import { clientIp } from '@/lib/api';
import { safeNext } from '@/components/store/labels';

export const dynamic = 'force-dynamic';

/** Step 1: remember a one-time state/nonce/PKCE verifier in a short-lived cookie, then send the visitor to Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleEnabled()) return NextResponse.redirect(new URL('/login?google=unavailable', url.origin));
  try { throttle(`google:${clientIp(req)}`, 20, 15 * 60 * 1000); } catch { return NextResponse.redirect(new URL('/login?google=busy', url.origin)); }
  const f = newFlow();
  const res = NextResponse.redirect(authUrl(`${url.origin}/api/auth/google/callback`, f));
  res.cookies.set(GOOGLE_COOKIE, JSON.stringify({ s: f.state, n: f.nonce, v: f.verifier, next: safeNext(url.searchParams.get('next')) }), {
    httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', path: '/api/auth/google', maxAge: 600,
  });
  return res;
}
