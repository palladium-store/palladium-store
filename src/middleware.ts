import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// First line of defence for /admin and /account. Real authorization (role, active user, permission) is enforced again
// on the server in requireStaff()/requireCustomer() for every page and API route.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('pal_session')?.value;
  let role: string | null = null;
  if (token && process.env.AUTH_SECRET) {
    try { role = ((await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET))).payload as { role?: string }).role ?? null; } catch { role = null; }
  }
  const isAdminArea = pathname.startsWith('/admin');
  if (!role) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in.' } }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  if (isAdminArea && role === 'CUSTOMER') {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Admin access required.' } }, { status: 403 });
    return NextResponse.redirect(new URL('/account', req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ['/admin/:path*', '/account/:path*', '/api/admin/:path*', '/api/account/:path*'] };
