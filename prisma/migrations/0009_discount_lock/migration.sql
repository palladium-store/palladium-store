-- Lock the discount row while an order is placed, so simultaneous checkouts cannot exceed its usage limit.
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
    SELECT * INTO d FROM "discounts" WHERE upper("code")=dcode FOR UPDATE;
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
