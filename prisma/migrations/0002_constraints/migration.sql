-- Business-rule constraints that the Prisma schema language cannot express.

-- Stock can never go negative at the database level unless an admin enables allowOversell on that row.
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_onhand_nonneg"
  CHECK ("allowOversell" OR "onHand" >= 0);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reserved_nonneg" CHECK ("reserved" >= 0);

ALTER TABLE "product_variants" ADD CONSTRAINT "variant_price_nonneg" CHECK ("priceCentavos" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "order_amounts_nonneg"
  CHECK ("subtotalCentavos" >= 0 AND "discountCentavos" >= 0 AND "shippingCentavos" >= 0 AND "totalCentavos" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_qty_pos" CHECK ("quantity" > 0);
ALTER TABLE "reviews" ADD CONSTRAINT "review_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "customers" ADD CONSTRAINT "customer_email_format"
  CHECK ("email" ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

-- Ledger integrity: previous + change must equal new.
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "ledger_math"
  CHECK ("previousOnHand" + "quantity" = "newOnHand" AND "previousReserved" + "reservedDelta" = "newReserved");

-- Append-only ledger: block UPDATE and DELETE on inventory_transactions.
CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory_transactions is append-only';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER inventory_ledger_append_only
  BEFORE UPDATE OR DELETE ON "inventory_transactions"
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- Orders are never deleted once created (business rule 1).
CREATE OR REPLACE FUNCTION forbid_order_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'orders cannot be deleted; cancel or refund instead';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER orders_no_delete BEFORE DELETE ON "orders" FOR EACH ROW EXECUTE FUNCTION forbid_order_delete();
CREATE TRIGGER order_items_no_delete BEFORE DELETE ON "order_items" FOR EACH ROW EXECUTE FUNCTION forbid_order_delete();

-- Case-insensitive uniqueness for e-mail and discount codes.
CREATE UNIQUE INDEX "users_email_lower_key" ON "users"(lower("email"));
CREATE UNIQUE INDEX "customers_email_lower_key" ON "customers"(lower("email"));
CREATE UNIQUE INDEX "discounts_code_upper_key" ON "discounts"(upper("code"));
