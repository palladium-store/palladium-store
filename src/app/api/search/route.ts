import { route, ok, qs, clientIp } from '@/lib/api';
import { throttle } from '@/lib/auth';
import { listProducts } from '@/lib/queries/catalog';

export const GET = route(async (req) => {
  throttle(`search:${clientIp(req)}`, 120, 60 * 1000);
  const q = (qs(req).q ?? '').trim().slice(0, 60);
  if (q.length < 2) return ok({ items: [] });
  const r = await listProducts({ q, pageSize: 6, sort: 'best' });
  return ok({ items: r.items.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image, category: p.category, inStock: p.inStock })) });
});
