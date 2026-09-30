-- Transactional inventory + order domain logic. Every stock change goes through pal_ledger(),
-- which row-locks the inventory row, validates, updates counters and appends an immutable ledger row.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 10001;

CREATE OR REPLACE FUNCTION pal_default_location() RETURNS text AS $$
  SELECT id FROM "locations" WHERE "isDefault" AND "isActive" ORDER BY id LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION pal_ledger(
  p_variant text, p_loc text, p_action "InventoryAction", p_dqty int, p_dres int,
  p_reason text, p_order text, p_user text, p_sold int DEFAULT 0, p_recv int DEFAULT 0
) RETURNS text AS $$
DECLARE inv "inventory"%ROWTYPE; v "product_variants"%ROWTYPE; tid text := gen_random_uuid()::text;
        prev_avail int; new_avail int; pname text;
BEGIN
  INSERT INTO "inventory"("id","variantId","locationId","updatedAt") VALUES (gen_random_uuid()::text,p_variant,p_loc,CURRENT_TIMESTAMP)
    ON CONFLICT ("variantId","locationId") DO NOTHING;
  SELECT * INTO inv FROM "inventory" WHERE "variantId"=p_variant AND "locationId"=p_loc FOR UPDATE;
  IF inv."onHand"+p_dqty < 0 AND NOT inv."allowOversell" THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK: variant % has % on hand, change % not allowed', p_variant, inv."onHand", p_dqty USING ERRCODE='P0001';
  END IF;
  IF inv."reserved"+p_dres < 0 THEN
    RAISE EXCEPTION 'RESERVED_UNDERFLOW: variant %', p_variant USING ERRCODE='P0001';
  END IF;
  prev_avail := inv."onHand"-inv."reserved";
  UPDATE "inventory" SET "onHand"="onHand"+p_dqty, "reserved"="reserved"+p_dres,
     "unitsSold"="unitsSold"+p_sold, "unitsReceived"="unitsReceived"+p_recv,
     "version"="version"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=inv."id";
  INSERT INTO "inventory_transactions"("id","variantId","locationId","action","quantity","reservedDelta",
     "previousOnHand","newOnHand","previousReserved","newReserved","reason","orderId","userId")
  VALUES (tid,p_variant,p_loc,p_action,p_dqty,p_dres,inv."onHand",inv."onHand"+p_dqty,inv."reserved",inv."reserved"+p_dres,p_reason,p_order,p_user);
  new_avail := (inv."onHand"+p_dqty)-(inv."reserved"+p_dres);
  IF new_avail < prev_avail THEN
    SELECT * INTO v FROM "product_variants" WHERE id=p_variant;
    SELECT p."name" INTO pname FROM "products" p WHERE p.id=v."productId";
    IF new_avail <= 0 AND prev_avail > 0 THEN
      INSERT INTO "notifications"("id","audience","kind","title","body","link")
      VALUES (gen_random_uuid()::text,'ADMIN','OUT_OF_STOCK',pname||' ('||v."name"||') is out of stock','SKU '||v."sku",'/admin/inventory');
    ELSIF new_avail <= v."lowStockThreshold" AND prev_avail > v."lowStockThreshold" THEN
      INSERT INTO "notifications"("id","audience","kind","title","body","link")
      VALUES (gen_random_uuid()::text,'ADMIN','LOW_STOCK',pname||' ('||v."name"||') is low: '||new_avail||' left','SKU '||v."sku",'/admin/inventory');
    END IF;
  END IF;
  RETURN tid;
END; $$ LANGUAGE plpgsql;

-- Admin inventory actions. qty is always positive except ADJUST, where qty is the counted on-hand target.
CREATE OR REPLACE FUNCTION pal_adjust_inventory(
  p_variant text, p_loc text, p_action "InventoryAction", p_qty int, p_reason text, p_user text
) RETURNS text AS $$
DECLARE cur int;
BEGIN
  IF p_loc IS NULL THEN p_loc := pal_default_location(); END IF;
  IF p_action IN ('RECEIVE','ADD','RETURNED','INITIAL') THEN
    IF p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY: must be positive' USING ERRCODE='P0001'; END IF;
    RETURN pal_ledger(p_variant,p_loc,p_action,p_qty,0,p_reason,NULL,p_user,0,CASE WHEN p_action IN ('RECEIVE','INITIAL') THEN p_qty ELSE 0 END);
  ELSIF p_action IN ('REMOVE','DAMAGED') THEN
    IF p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY: must be positive' USING ERRCODE='P0001'; END IF;
    RETURN pal_ledger(p_variant,p_loc,p_action,-p_qty,0,p_reason,NULL,p_user);
  ELSIF p_action = 'ADJUST' THEN
    IF p_qty < 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY: count cannot be negative' USING ERRCODE='P0001'; END IF;
    INSERT INTO "inventory"("id","variantId","locationId","updatedAt") VALUES (gen_random_uuid()::text,p_variant,p_loc,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
    SELECT "onHand" INTO cur FROM "inventory" WHERE "variantId"=p_variant AND "locationId"=p_loc;
    RETURN pal_ledger(p_variant,p_loc,'ADJUST',p_qty-cur,0,p_reason,NULL,p_user);
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_ACTION: %', p_action USING ERRCODE='P0001';
  END IF;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pal_transfer_inventory(
  p_variant text, p_from text, p_to text, p_qty int, p_reason text, p_user text
) RETURNS void AS $$
BEGIN
  IF p_from = p_to THEN RAISE EXCEPTION 'INVALID_TRANSFER: same location' USING ERRCODE='P0001'; END IF;
  IF p_qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY: must be positive' USING ERRCODE='P0001'; END IF;
  PERFORM pal_ledger(p_variant,p_from,'TRANSFER_OUT',-p_qty,0,p_reason,NULL,p_user);
  PERFORM pal_ledger(p_variant,p_to,'TRANSFER_IN',p_qty,0,p_reason,NULL,p_user);
END; $$ LANGUAGE plpgsql;

-- Places an order. Prices, names and SKUs are read from the DB and snapshotted onto the order.
-- p: {customerId,email,phone,method,discountCode,shippingCentavos,shippingZone,notes,idempotencyKey,
--     ship:{name,phone,line1,barangay,city,province,postalCode}, items:[{variantId,qty}]}
CREATE OR REPLACE FUNCTION pal_place_order(p jsonb) RETURNS jsonb AS $$
DECLARE
  oid text := gen_random_uuid()::text; onum text; existing "orders"%ROWTYPE;
  loc text := pal_default_location(); it record; v "product_variants"%ROWTYPE; pr "products"%ROWTYPE;
  inv "inventory"%ROWTYPE; sub int := 0; disc int := 0; ship int := COALESCE((p->>'shippingCentavos')::int,0);
  d "discounts"%ROWTYPE; dcode text := NULLIF(upper(trim(p->>'discountCode')),''); elig int := 0;
  used_by int; method "PaymentMethod" := (p->>'method')::"PaymentMethod"; cust text := p->>'customerId';
  remaining int; lines int := 0; last_elig text; li record; alloc int; total int;
BEGIN
  IF p->>'idempotencyKey' IS NOT NULL THEN
    SELECT * INTO existing FROM "orders" WHERE "idempotencyKey"=p->>'idempotencyKey';
    IF FOUND THEN RETURN jsonb_build_object('orderId',existing.id,'orderNumber',existing."orderNumber",'totalCentavos',existing."totalCentavos",'duplicate',true); END IF;
  END IF;
  IF jsonb_array_length(p->'items')=0 THEN RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE='P0001'; END IF;
  IF ship < 0 THEN RAISE EXCEPTION 'INVALID_SHIPPING' USING ERRCODE='P0001'; END IF;
  onum := 'PAL-'||nextval('order_number_seq');

  -- temp working set, merged by variant and ordered for deterministic lock order
  CREATE TEMP TABLE IF NOT EXISTS _cart(variant text, qty int, price int, cost int, pname text, vname text, sku text, img text, prodid text, catid text, is_elig boolean, line_disc int) ON COMMIT DROP;
  DELETE FROM _cart;
  FOR it IN SELECT (e->>'variantId') AS variant, SUM((e->>'qty')::int) AS qty FROM jsonb_array_elements(p->'items') e GROUP BY 1 ORDER BY 1 LOOP
    IF it.qty <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE='P0001'; END IF;
    SELECT * INTO v FROM "product_variants" WHERE id=it.variant AND "isActive";
    IF NOT FOUND THEN RAISE EXCEPTION 'VARIANT_UNAVAILABLE: %', it.variant USING ERRCODE='P0001'; END IF;
    SELECT * INTO pr FROM "products" WHERE id=v."productId";
    IF pr."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE: %', pr."name" USING ERRCODE='P0001'; END IF;
    INSERT INTO "inventory"("id","variantId","locationId","updatedAt") VALUES (gen_random_uuid()::text,v.id,loc,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
    SELECT * INTO inv FROM "inventory" WHERE "variantId"=v.id AND "locationId"=loc FOR UPDATE;
    IF (inv."onHand"-inv."reserved") < it.qty AND NOT inv."allowOversell" THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: only % available for % (%)', GREATEST(inv."onHand"-inv."reserved",0), pr."name", v."name" USING ERRCODE='P0001';
    END IF;
    INSERT INTO _cart VALUES (v.id,it.qty,v."priceCentavos",v."costCentavos",pr."name",v."name",v."sku",COALESCE(v."imageUrl",(SELECT url FROM "product_images" WHERE "productId"=pr.id ORDER BY position LIMIT 1)),pr.id,pr."categoryId",true,0);
    sub := sub + v."priceCentavos"*it.qty;
  END LOOP;

  IF dcode IS NOT NULL THEN
    SELECT * INTO d FROM "discounts" WHERE upper("code")=dcode;
    IF NOT FOUND OR NOT d."isActive" THEN RAISE EXCEPTION 'DISCOUNT_INVALID: dcode not found' USING ERRCODE='P0001'; END IF;
    IF (d."startsAt" IS NOT NULL AND d."startsAt" > now()) OR (d."endsAt" IS NOT NULL AND d."endsAt" < now()) THEN
      RAISE EXCEPTION 'DISCOUNT_INVALID: dcode is not currently valid' USING ERRCODE='P0001'; END IF;
    IF d."usageLimit" IS NOT NULL AND d."timesUsed" >= d."usageLimit" THEN RAISE EXCEPTION 'DISCOUNT_INVALID: usage limit reached' USING ERRCODE='P0001'; END IF;
    IF d."perCustomerLimit" IS NOT NULL THEN
      SELECT count(*) INTO used_by FROM "discount_usage" WHERE "discountId"=d.id AND "customerId"=cust;
      IF used_by >= d."perCustomerLimit" THEN RAISE EXCEPTION 'DISCOUNT_INVALID: you already used this code' USING ERRCODE='P0001'; END IF;
    END IF;
    IF sub < d."minOrderCentavos" THEN RAISE EXCEPTION 'DISCOUNT_INVALID: minimum order not met' USING ERRCODE='P0001'; END IF;
    IF cardinality(d."productIds")>0 OR cardinality(d."categoryIds")>0 THEN
      UPDATE _cart SET is_elig = (prodid = ANY(d."productIds") OR catid = ANY(d."categoryIds"));
    END IF;
    SELECT COALESCE(sum(price*qty),0) INTO elig FROM _cart WHERE _cart.is_elig;
    IF elig = 0 THEN RAISE EXCEPTION 'DISCOUNT_INVALID: dcode does not apply to these items' USING ERRCODE='P0001'; END IF;
    IF d."type"='PERCENTAGE' THEN disc := floor(elig::numeric*d."value"/100)::int; ELSE disc := LEAST(d."value",elig); END IF;
    IF d."maxDiscountCentavos" IS NOT NULL THEN disc := LEAST(disc,d."maxDiscountCentavos"); END IF;
    -- pro-rata line allocation, remainder on the last eligible line
    remaining := disc;
    SELECT variant INTO last_elig FROM _cart WHERE _cart.is_elig ORDER BY variant DESC LIMIT 1;
    FOR li IN SELECT * FROM _cart WHERE _cart.is_elig ORDER BY variant LOOP
      IF li.variant = last_elig THEN alloc := remaining; ELSE alloc := floor(disc::numeric*(li.price::numeric*li.qty)/elig)::int; END IF;
      remaining := remaining - alloc;
      UPDATE _cart SET line_disc=alloc WHERE variant=li.variant;
    END LOOP;
  END IF;
  total := sub - disc + ship;

  INSERT INTO "orders"("id","orderNumber","idempotencyKey","customerId","email","phone","status","paymentStatus","paymentMethod",
    "subtotalCentavos","discountCentavos","shippingCentavos","totalCentavos","discountCode","shipName","shipPhone","shipLine1",
    "shipBarangay","shipCity","shipProvince","shipPostalCode","shippingZone","customerNotes","updatedAt")
  VALUES (oid,onum,p->>'idempotencyKey',cust,p->>'email',p->>'phone',
    CASE WHEN method='COD' THEN 'PENDING' ELSE 'PAYMENT_PENDING' END::"OrderStatus",'PENDING',method,
    sub,disc,ship,total,dcode,p#>>'{ship,name}',p#>>'{ship,phone}',p#>>'{ship,line1}',p#>>'{ship,barangay}',p#>>'{ship,city}',
    p#>>'{ship,province}',p#>>'{ship,postalCode}',p->>'shippingZone',p->>'notes',CURRENT_TIMESTAMP);
  INSERT INTO "order_items"("id","orderId","variantId","productName","variantName","sku","imageUrl","unitPriceCentavos","unitCostCentavos","quantity","discountCentavos","lineTotalCentavos")
    SELECT gen_random_uuid()::text,oid,variant,pname,vname,sku,img,price,cost,qty,line_disc,price*qty-line_disc FROM _cart;
  FOR li IN SELECT * FROM _cart ORDER BY variant LOOP
    PERFORM pal_ledger(li.variant,loc,'RESERVE',0,li.qty,'Reserved for '||onum,oid,NULL);
  END LOOP;
  INSERT INTO "payments"("id","orderId","method","status","amountCentavos") VALUES (gen_random_uuid()::text,oid,method,'PENDING',total);
  IF dcode IS NOT NULL THEN
    INSERT INTO "discount_usage"("id","discountId","orderId","customerId","amountCentavos") VALUES (gen_random_uuid()::text,d.id,oid,cust,disc);
    UPDATE "discounts" SET "timesUsed"="timesUsed"+1 WHERE id=d.id;
  END IF;
  INSERT INTO "order_events"("id","orderId","type","message","actor") VALUES (gen_random_uuid()::text,oid,'PLACED','Order placed by customer','customer');
  INSERT INTO "notifications"("id","audience","kind","title","body","link")
    VALUES (gen_random_uuid()::text,'ADMIN','NEW_ORDER','New order '||onum,'Total PHP '||to_char(total/100.0,'FM999,999,990.00')||' via '||method,'/admin/orders/'||oid);
  INSERT INTO "notifications"("id","audience","kind","title","channel","recipient","link")
    VALUES (gen_random_uuid()::text,'CUSTOMER','ORDER_CONFIRMATION','Order '||onum||' received','EMAIL',p->>'email','/account/orders/'||oid);
  RETURN jsonb_build_object('orderId',oid,'orderNumber',onum,'totalCentavos',total,'duplicate',false);
END; $$ LANGUAGE plpgsql;

-- Confirms an order: converts reserved stock into a sale. mark_paid=false for COD (cash collected later).
CREATE OR REPLACE FUNCTION pal_confirm_order(p_order text, p_user text, p_mark_paid boolean, p_ref text DEFAULT NULL) RETURNS void AS $$
DECLARE o "orders"%ROWTYPE; li record; loc text := pal_default_location(); uname text;
BEGIN
  SELECT * INTO o FROM "orders" WHERE id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF o."stockCommitted" THEN
    IF p_mark_paid AND o."paymentStatus"<>'PAID' THEN
      UPDATE "orders" SET "paymentStatus"='PAID', "paidAt"=now(), "updatedAt"=now(),
        "status"=CASE WHEN "status" IN ('PENDING','PAYMENT_PENDING') THEN 'PAID' ELSE "status" END::"OrderStatus" WHERE id=p_order;
      UPDATE "payments" SET "status"='PAID',"paidAt"=now(),"providerRef"=COALESCE(p_ref,"providerRef") WHERE "orderId"=p_order AND "status"<>'PAID';
      INSERT INTO "order_events"("id","orderId","type","message","actor") VALUES (gen_random_uuid()::text,p_order,'PAYMENT','Payment recorded',p_user);
    END IF;
    RETURN;
  END IF;
  IF o."status" NOT IN ('PENDING','PAYMENT_PENDING') THEN RAISE EXCEPTION 'INVALID_STATE: order is %', o."status" USING ERRCODE='P0001'; END IF;
  FOR li IN SELECT * FROM "order_items" WHERE "orderId"=p_order AND "variantId" IS NOT NULL ORDER BY "variantId" LOOP
    PERFORM pal_ledger(li."variantId",loc,'SALE',-li.quantity,-li.quantity,'Sale '||o."orderNumber",p_order,p_user,li.quantity,0);
  END LOOP;
  UPDATE "orders" SET "stockCommitted"=true,
    "status"=CASE WHEN p_mark_paid THEN 'PAID' ELSE 'PROCESSING' END::"OrderStatus",
    "paymentStatus"=CASE WHEN p_mark_paid THEN 'PAID' ELSE "paymentStatus" END::"PaymentStatus",
    "paidAt"=CASE WHEN p_mark_paid THEN now() ELSE "paidAt" END, "updatedAt"=now() WHERE id=p_order;
  IF p_mark_paid THEN
    UPDATE "payments" SET "status"='PAID',"paidAt"=now(),"providerRef"=p_ref WHERE "orderId"=p_order;
    INSERT INTO "notifications"("id","audience","kind","title","link") VALUES (gen_random_uuid()::text,'ADMIN','PAYMENT_RECEIVED','Payment received for '||o."orderNumber",'/admin/orders/'||p_order);
    INSERT INTO "notifications"("id","audience","kind","title","channel","recipient","link") VALUES (gen_random_uuid()::text,'CUSTOMER','PAYMENT_CONFIRMATION','Payment received for '||o."orderNumber",'EMAIL',o."email",'/account/orders/'||p_order);
  END IF;
  INSERT INTO "order_events"("id","orderId","type","message","actor")
    VALUES (gen_random_uuid()::text,p_order,'CONFIRMED',CASE WHEN p_mark_paid THEN 'Payment confirmed, stock deducted' ELSE 'Order confirmed (COD), stock deducted' END,COALESCE(p_user,'system'));
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pal_fail_payment(p_order text, p_user text, p_reason text) RETURNS void AS $$
DECLARE o "orders"%ROWTYPE;
BEGIN
  SELECT * INTO o FROM "orders" WHERE id=p_order FOR UPDATE;
  UPDATE "payments" SET "status"='FAILED' WHERE "orderId"=p_order AND "status"='PENDING';
  INSERT INTO "order_events"("id","orderId","type","message","actor") VALUES (gen_random_uuid()::text,p_order,'PAYMENT_FAILED',COALESCE(p_reason,'Payment failed'),p_user);
  INSERT INTO "notifications"("id","audience","kind","title","link") VALUES (gen_random_uuid()::text,'ADMIN','PAYMENT_FAILED','Payment failed for '||o."orderNumber",'/admin/orders/'||p_order);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pal_cancel_order(p_order text, p_reason text, p_user text) RETURNS void AS $$
DECLARE o "orders"%ROWTYPE; li record; loc text := pal_default_location();
BEGIN
  SELECT * INTO o FROM "orders" WHERE id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF o."status" IN ('SHIPPED','DELIVERED','CANCELLED','REFUNDED') THEN
    RAISE EXCEPTION 'INVALID_STATE: cannot cancel an order that is %', o."status" USING ERRCODE='P0001'; END IF;
  FOR li IN SELECT * FROM "order_items" WHERE "orderId"=p_order AND "variantId" IS NOT NULL ORDER BY "variantId" LOOP
    IF o."stockCommitted" THEN
      PERFORM pal_ledger(li."variantId",loc,'CANCEL_RESTOCK',li.quantity,0,'Cancelled '||o."orderNumber",p_order,p_user,-li.quantity,0);
    ELSE
      PERFORM pal_ledger(li."variantId",loc,'RELEASE',0,-li.quantity,'Released '||o."orderNumber",p_order,p_user);
    END IF;
  END LOOP;
  DELETE FROM "discount_usage" WHERE "orderId"=p_order;
  UPDATE "discounts" SET "timesUsed"=GREATEST("timesUsed"-1,0) WHERE upper("code")=upper(o."discountCode");
  UPDATE "orders" SET "status"='CANCELLED', "cancelledAt"=now(), "updatedAt"=now(),
     "stockCommitted"=false,
     "paymentStatus"=CASE WHEN "paymentStatus"='PAID' THEN 'REFUNDED' ELSE "paymentStatus" END::"PaymentStatus",
     "refundedCentavos"=CASE WHEN "paymentStatus"='PAID' THEN "totalCentavos" ELSE "refundedCentavos" END WHERE id=p_order;
  INSERT INTO "order_events"("id","orderId","type","message","actor") VALUES (gen_random_uuid()::text,p_order,'CANCELLED',COALESCE(p_reason,'Order cancelled'),COALESCE(p_user,'system'));
END; $$ LANGUAGE plpgsql;

-- Refund (full or partial). p_items: [{orderItemId,qty}] to return to stock; NULL with p_restock => everything not yet returned.
CREATE OR REPLACE FUNCTION pal_refund_order(p_order text, p_amount int, p_restock boolean, p_items jsonb, p_reason text, p_user text) RETURNS void AS $$
DECLARE o "orders"%ROWTYPE; li record; loc text := pal_default_location(); q int; newref int;
BEGIN
  SELECT * INTO o FROM "orders" WHERE id=p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF o."paymentStatus" NOT IN ('PAID','PARTIALLY_REFUNDED') THEN RAISE EXCEPTION 'INVALID_STATE: order has not been paid' USING ERRCODE='P0001'; END IF;
  IF p_amount <= 0 OR o."refundedCentavos"+p_amount > o."totalCentavos" THEN RAISE EXCEPTION 'INVALID_REFUND_AMOUNT' USING ERRCODE='P0001'; END IF;
  IF p_restock AND o."stockCommitted" THEN
    FOR li IN SELECT * FROM "order_items" WHERE "orderId"=p_order AND "variantId" IS NOT NULL ORDER BY "variantId" LOOP
      IF p_items IS NULL THEN q := li.quantity-li."returnedQty";
      ELSE SELECT COALESCE(sum((e->>'qty')::int),0) INTO q FROM jsonb_array_elements(p_items) e WHERE e->>'orderItemId'=li.id; END IF;
      IF q > li.quantity-li."returnedQty" THEN RAISE EXCEPTION 'INVALID_RETURN_QTY for %', li."sku" USING ERRCODE='P0001'; END IF;
      IF q > 0 THEN
        PERFORM pal_ledger(li."variantId",loc,'REFUND_RESTOCK',q,0,COALESCE(p_reason,'Returned '||o."orderNumber"),p_order,p_user,-q,0);
        UPDATE "order_items" SET "returnedQty"="returnedQty"+q WHERE id=li.id;
      END IF;
    END LOOP;
  END IF;
  newref := o."refundedCentavos"+p_amount;
  UPDATE "orders" SET "refundedCentavos"=newref, "updatedAt"=now(),
     "paymentStatus"=CASE WHEN newref=o."totalCentavos" THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END::"PaymentStatus",
     "status"=CASE WHEN newref=o."totalCentavos" THEN 'REFUNDED' ELSE "status" END::"OrderStatus" WHERE id=p_order;
  UPDATE "payments" SET "status"=CASE WHEN newref=o."totalCentavos" THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END::"PaymentStatus" WHERE "orderId"=p_order;
  INSERT INTO "order_events"("id","orderId","type","message","actor") VALUES (gen_random_uuid()::text,p_order,'REFUND','Refunded PHP '||to_char(p_amount/100.0,'FM999,999,990.00')||COALESCE(': '||p_reason,''),p_user);
  INSERT INTO "notifications"("id","audience","kind","title","link") VALUES (gen_random_uuid()::text,'ADMIN','REFUND','Refund issued for '||o."orderNumber",'/admin/orders/'||p_order);
  INSERT INTO "notifications"("id","audience","kind","title","channel","recipient") VALUES (gen_random_uuid()::text,'CUSTOMER','REFUND_CONFIRMATION','Refund issued for '||o."orderNumber",'EMAIL',o."email");
END; $$ LANGUAGE plpgsql;
