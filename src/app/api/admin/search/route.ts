import { adminRoute, ok, qs } from '@/lib/api';
import { globalSearch } from '@/lib/queries/admin';
import { can } from '@/lib/rbac';

export const GET = adminRoute(null, async (req, _c, user) =>
  ok(await globalSearch(qs(req).q ?? '', { orders: can(user.role, 'VIEW_ORDERS'), products: can(user.role, 'MANAGE_PRODUCTS') || can(user.role, 'MANAGE_INVENTORY'), customers: can(user.role, 'VIEW_CUSTOMERS') })));
