-- Manual storefront ordering. Lower sortOrder shows first; new products default to 0 (top).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "products_sortOrder_idx" ON "products"("sortOrder");
-- Keep today's order as the starting point: featured first, then newest.
UPDATE "products" p SET "sortOrder" = r.rn
FROM (SELECT id, row_number() OVER (ORDER BY "isFeatured" DESC, "createdAt" DESC) AS rn FROM "products") r
WHERE r.id = p.id;
