import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';

export interface ProductCard {
  id: string; name: string; slug: string; category: string; categorySlug: string; isLimited: boolean; isFeatured: boolean; createdAt: Date; shortDescription: string | null; image2: string | null; variants: { id: string; name: string; image: string | null; price: number; compareAt: number | null; available: number }[];
  price: number; compareAt: number | null; image: string | null; inStock: boolean; rating: number | null; reviewCount: number; sold: number; variantCount: number;
}
export type Sort = 'featured' | 'newest' | 'best' | 'price_asc' | 'price_desc';
const SORTS: Record<Sort, Prisma.Sql> = {
  featured: Prisma.sql`"sortOrder" ASC, "createdAt" DESC`,
  newest: Prisma.sql`"createdAt" DESC`,
  best: Prisma.sql`sold DESC, "createdAt" DESC`,
  price_asc: Prisma.sql`price ASC, name ASC`,
  price_desc: Prisma.sql`price DESC, name ASC`,
};

const base = Prisma.sql`
  SELECT p.id, p.name, p.slug, c.name AS category, c.slug AS "categorySlug", p."isLimited", p."isFeatured", p."createdAt", p."sortOrder", p.tags,
    (SELECT COALESCE(json_agg(json_build_object('id', x.id, 'name', x.name, 'image', x."imageUrl", 'price', x."priceCentavos", 'compareAt', x."compareAtCentavos",
        'available', (SELECT CASE WHEN COALESCE(bool_or(i."allowOversell"), false) THEN 999 ELSE GREATEST(COALESCE(sum(i."onHand" - i.reserved), 0), 0) END
                      FROM inventory i JOIN locations l ON l.id = i."locationId" AND l."isDefault" WHERE i."variantId" = x.id)::int)
      ORDER BY x.position, x."createdAt"), '[]'::json) FROM product_variants x WHERE x."productId"=p.id AND x."isActive") AS variants,
    p."shortDescription" AS "shortDescription",
    (SELECT url FROM product_images pi2 WHERE pi2."productId"=p.id AND pi2.kind='image' ORDER BY position OFFSET 1 LIMIT 1) AS image2,
    MIN(v."priceCentavos")::int AS price,
    MIN(v."compareAtCentavos") FILTER (WHERE v."compareAtCentavos" > v."priceCentavos")::int AS "compareAt",
    (SELECT url FROM product_images pi WHERE pi."productId"=p.id AND pi.kind='image' ORDER BY position LIMIT 1) AS image,
    COALESCE(bool_or(COALESCE(inv.avail,0) > 0 OR COALESCE(inv.oversell,false)), false) AS "inStock",
    (SELECT round(avg(rating)::numeric,1)::float FROM reviews r WHERE r."productId"=p.id AND r."isApproved") AS rating,
    (SELECT count(*)::int FROM reviews r WHERE r."productId"=p.id AND r."isApproved") AS "reviewCount",
    (SELECT COALESCE(sum(oi.quantity),0)::int FROM order_items oi JOIN product_variants pv ON pv.id=oi."variantId" JOIN orders o ON o.id=oi."orderId"
       WHERE pv."productId"=p.id AND o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED')) AS sold,
    count(v.id)::int AS "variantCount"
  FROM products p JOIN categories c ON c.id=p."categoryId"
  JOIN product_variants v ON v."productId"=p.id AND v."isActive"
  LEFT JOIN LATERAL (SELECT sum(i."onHand"-i.reserved) AS avail, bool_or(i."allowOversell") AS oversell FROM inventory i JOIN locations l ON l.id=i."locationId" AND l."isDefault" WHERE i."variantId"=v.id) inv ON true
  WHERE p.status IN ('ACTIVE','SOLD_OUT')
  GROUP BY p.id, c.id`;

export interface ListOpts { category?: string; q?: string; min?: number; max?: number; availability?: 'in' | 'out'; sort?: Sort; page?: number; pageSize?: number; limited?: boolean; featured?: boolean; excludeId?: string; ids?: string[] }
export async function listProducts(o: ListOpts = {}) {
  const page = Math.max(o.page ?? 1, 1), size = Math.min(o.pageSize ?? 12, 48);
  const conds: Prisma.Sql[] = [];
  if (o.category) conds.push(Prisma.sql`"categorySlug" = ${o.category}`);
  if (o.q) { const like = `%${o.q}%`; conds.push(Prisma.sql`(name ILIKE ${like} OR category ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE ${like}))`); }
  if (o.min != null) conds.push(Prisma.sql`price >= ${o.min}`);
  if (o.max != null) conds.push(Prisma.sql`price <= ${o.max}`);
  if (o.availability === 'in') conds.push(Prisma.sql`"inStock"`);
  if (o.availability === 'out') conds.push(Prisma.sql`NOT "inStock"`);
  if (o.limited) conds.push(Prisma.sql`"isLimited"`);
  if (o.featured) conds.push(Prisma.sql`"isFeatured"`);
  if (o.excludeId) conds.push(Prisma.sql`id <> ${o.excludeId}`);
  if (o.ids) conds.push(Prisma.sql`id = ANY(${o.ids})`);
  const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, ' AND ')}` : Prisma.empty;
  const [items, count] = await Promise.all([
    prisma.$queryRaw<ProductCard[]>(Prisma.sql`SELECT * FROM (${base}) t ${where} ORDER BY ${SORTS[o.sort ?? 'featured']} LIMIT ${size} OFFSET ${(page - 1) * size}`),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`SELECT count(*)::int AS n FROM (${base}) t ${where}`),
  ]);
  return { items, total: count[0].n, page, pageSize: size, pages: Math.max(Math.ceil(count[0].n / size), 1) };
}

export async function listCategories() {
  const rows = await prisma.$queryRaw<{ id: string; name: string; slug: string; count: number }[]>`
    SELECT c.id, c.name, c.slug, count(p.id) FILTER (WHERE p.status IN ('ACTIVE','SOLD_OUT'))::int AS count
    FROM categories c LEFT JOIN products p ON p."categoryId"=c.id GROUP BY c.id ORDER BY c."sortOrder", c.name`;
  return rows;
}
export async function priceBounds() {
  const [r] = await prisma.$queryRaw<{ min: number | null; max: number | null }[]>`SELECT min(v."priceCentavos")::int AS min, max(v."priceCentavos")::int AS max FROM product_variants v JOIN products p ON p.id=v."productId" WHERE p.status IN ('ACTIVE','SOLD_OUT') AND v."isActive"`;
  return { min: r?.min ?? 0, max: r?.max ?? 0 };
}

export async function getProduct(slug: string) {
  const p = await prisma.product.findFirst({
    where: { slug, status: { in: ['ACTIVE', 'SOLD_OUT'] } },
    include: { category: true, images: { orderBy: { position: 'asc' } }, variants: { where: { isActive: true }, orderBy: { position: 'asc' }, include: { levels: { where: { location: { isDefault: true } } } } } },
  });
  if (!p) return null;
  const reviews = await prisma.review.findMany({ where: { productId: p.id, isApproved: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;
  return {
    ...p, reviews, ratingAvg: avg, reviewCount: reviews.length,
    variants: p.variants.map((v) => { const l = v.levels[0]; const available = l ? (l.allowOversell ? 9999 : Math.max(l.onHand - l.reserved, 0)) : 0; return { id: v.id, name: v.name, sku: v.sku, priceCentavos: v.priceCentavos, compareAtCentavos: v.compareAtCentavos, imageUrl: v.imageUrl, available, lowStock: available > 0 && available <= v.lowStockThreshold }; }),
  };
}

export async function relatedProducts(productId: string, categoryId: string, limit = 4) {
  const [cat, pool] = await Promise.all([prisma.category.findUnique({ where: { id: categoryId } }), listProducts({ excludeId: productId, pageSize: 24, sort: 'best' })]);
  const same = pool.items.filter((i) => i.categorySlug === cat?.slug);
  return [...same, ...pool.items.filter((i) => i.categorySlug !== cat?.slug)].slice(0, limit);
}

/** Products most often bought in the same order, falling back to best sellers from other categories. */
export async function boughtTogether(productId: string, limit = 3) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT pv2."productId" AS id, count(*) AS n
    FROM order_items a JOIN product_variants pv1 ON pv1.id=a."variantId" AND pv1."productId"=${productId}
    JOIN order_items b ON b."orderId"=a."orderId" AND b.id<>a.id JOIN product_variants pv2 ON pv2.id=b."variantId" AND pv2."productId"<>${productId}
    JOIN orders o ON o.id=a."orderId" AND o.status NOT IN ('PENDING','PAYMENT_PENDING','CANCELLED')
    GROUP BY pv2."productId" ORDER BY n DESC LIMIT ${limit}`;
  let ids = rows.map((r) => r.id);
  if (ids.length < limit) {
    const fill = await listProducts({ excludeId: productId, pageSize: limit + 4, sort: 'best' });
    ids = [...ids, ...fill.items.map((i) => i.id).filter((i) => !ids.includes(i))].slice(0, limit);
  }
  if (!ids.length) return [];
  const { items } = await listProducts({ ids, pageSize: limit });
  return ids.map((id) => items.find((i) => i.id === id)).filter(Boolean) as ProductCard[];
}

export async function homeData() {
  const [featured, best, fresh, limited, categories, reviews, stats] = await Promise.all([
    listProducts({ featured: true, pageSize: 4 }), listProducts({ sort: 'best', pageSize: 4 }), listProducts({ sort: 'newest', pageSize: 4 }),
    listProducts({ limited: true, pageSize: 3 }), listCategories(),
    prisma.review.findMany({ where: { isApproved: true, rating: { gte: 4 } }, orderBy: { createdAt: 'desc' }, take: 3, include: { product: { select: { name: true, slug: true } } } }),
    prisma.review.aggregate({ where: { isApproved: true }, _avg: { rating: true }, _count: true }),
  ]);
  return { featured: featured.items, best: best.items, fresh: fresh.items, limited: limited.items, categories, reviews, ratingAvg: stats._avg.rating, ratingCount: stats._count };
}
