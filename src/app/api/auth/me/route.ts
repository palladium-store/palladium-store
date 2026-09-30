import { route, ok } from '@/lib/api';
import { getUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const GET = route(async () => { const u = await getUser(); return ok({ user: u ? { name: u.name, email: u.email, role: u.role } : null }); });
