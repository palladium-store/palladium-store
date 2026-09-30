-- Database workflow tests. Run against an empty, migrated database: psql -v ON_ERROR_STOP=1 -f prisma/tests/workflows.sql
-- Each block raises an exception on failure. Everything runs in one transaction and is rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION _assert(cond boolean, msg text) RETURNS void AS $$ BEGIN IF NOT cond THEN RAISE EXCEPTION 'TEST FAILED: %', msg; END IF; END $$ LANGUAGE plpgsql;

INSERT INTO "locations"(id,name,code,type,"isDefault") VALUES ('loc1','Main warehouse','MAIN','WAREHOUSE',true);
INSERT INTO "users"(id,email,"passwordHash",name,role,"updatedAt") VALUES ('adm1','admin@test.ph','x','Admin John','SUPER_ADMIN',now());
INSERT INTO "categories"(id,name,slug) VALUES ('cat1','Paddles','paddles'),('cat2','Grips','grips');
INSERT INTO "products"(id,name,slug,"categoryId",status,"updatedAt") VALUES ('p1','Palladium KORU','koru','cat1','ACTIVE',now()),('p2','Palladium Grip Tape','grip','cat2','ACTIVE',now());
INSERT INTO "product_variants"(id,"productId",name,sku,"priceCentavos","costCentavos","lowStockThreshold","updatedAt") VALUES
 ('v1','p1','Standard','KORU-STD',450000,200000,5,now()),('v2','p2','Black','GRIP-BLK',35000,8000,5,now());
INSERT INTO "customers"(id,email,name,phone,"updatedAt") VALUES ('c1','juan@example.com','Juan Dela Cruz','09171234567',now()),('c2','maria@example.com','Maria Santos','09181234567',now());
INSERT INTO "discounts"(id,code,type,value,"minOrderCentavos","perCustomerLimit") VALUES ('d1','WELCOME10','PERCENTAGE',10,0,1),('d2','PALLADIUM500','FIXED',50000,100000,NULL);

-- 1. Starting stock 100, sell 2 => 98
SELECT pal_adjust_inventory('v1',NULL,'RECEIVE',100,'Initial stock','adm1');
SELECT pal_adjust_inventory('v2',NULL,'RECEIVE',200,'Initial stock','adm1');
DO $$ DECLARE r jsonb; oid text; i "inventory"%ROWTYPE; o "orders"%ROWTYPE; BEGIN
  r := pal_place_order('{"customerId":"c1","email":"juan@example.com","phone":"09171234567","method":"GCASH","shippingCentavos":15000,"shippingZone":"Metro Manila","idempotencyKey":"k1",
     "ship":{"name":"Juan Dela Cruz","phone":"09171234567","line1":"1 Rizal St","barangay":"Poblacion","city":"Makati","province":"Metro Manila","postalCode":"1200"},
     "items":[{"variantId":"v1","qty":2},{"variantId":"v2","qty":1}]}');
  oid := r->>'orderId';
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v1'; PERFORM _assert(i."onHand"=100 AND i."reserved"=2,'reserve keeps onHand, reserves 2');
  PERFORM _assert(i."onHand"-i."reserved"=98,'available=98 after order placed');
  SELECT * INTO o FROM "orders" WHERE id=oid;
  PERFORM _assert(o."subtotalCentavos"=935000 AND o."totalCentavos"=950000,'totals: '||o."totalCentavos");
  PERFORM _assert(o."orderNumber" ~ '^PAL-\d{5}$','order number format');
  -- 2. idempotency
  r := pal_place_order('{"customerId":"c1","email":"juan@example.com","phone":"0917","method":"GCASH","shippingCentavos":15000,"idempotencyKey":"k1","ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v1","qty":2}]}');
  PERFORM _assert((r->>'duplicate')::boolean AND r->>'orderId'=oid,'double submit returns same order');
  PERFORM _assert((SELECT count(*) FROM "orders")=1,'only one order exists');
  -- confirm payment
  PERFORM pal_confirm_order(oid,'adm1',true,'GCASH-REF-1');
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v1'; PERFORM _assert(i."onHand"=98 AND i."reserved"=0 AND i."unitsSold"=2,'stock 98 after payment');
  SELECT * INTO o FROM "orders" WHERE id=oid; PERFORM _assert(o.status='PAID' AND o."paymentStatus"='PAID' AND o."stockCommitted",'order paid');
  PERFORM pal_confirm_order(oid,'adm1',true,'GCASH-REF-1');
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v1'; PERFORM _assert(i."onHand"=98,'confirming twice does not double deduct');
  -- price snapshot
  UPDATE "product_variants" SET "priceCentavos"=999900 WHERE id='v1';
  PERFORM _assert((SELECT "unitPriceCentavos" FROM "order_items" WHERE "orderId"=oid AND "variantId"='v1')=450000,'historical price preserved');
  UPDATE "product_variants" SET "priceCentavos"=450000 WHERE id='v1';
  -- refund with restock (1 paddle)
  PERFORM pal_refund_order(oid,450000,true,('[{"orderItemId":"'||(SELECT id FROM "order_items" WHERE "orderId"=oid AND "variantId"='v1')||'","qty":1}]')::jsonb,'Customer return','adm1');
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v1'; PERFORM _assert(i."onHand"=99 AND i."unitsSold"=1,'return restocked 1 => 99');
  SELECT * INTO o FROM "orders" WHERE id=oid; PERFORM _assert(o."paymentStatus"='PARTIALLY_REFUNDED' AND o."refundedCentavos"=450000,'partial refund recorded');
END $$;

-- 3. Cannot oversell
DO $$ BEGIN
  BEGIN PERFORM pal_place_order('{"customerId":"c1","email":"a@b.co","phone":"1","method":"COD","shippingCentavos":0,"ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v1","qty":500}]}'); RAISE EXCEPTION 'TEST FAILED: oversell allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM NOT LIKE 'INSUFFICIENT_STOCK%' THEN RAISE; END IF; END;
  BEGIN PERFORM pal_adjust_inventory('v1',NULL,'REMOVE',10000,'x','adm1'); RAISE EXCEPTION 'TEST FAILED: negative stock allowed';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM NOT LIKE 'INSUFFICIENT_STOCK%' THEN RAISE; END IF; END;
END $$;

-- 4. Cancel before confirmation releases the reservation; COD flow; cancel after confirmation restocks
DO $$ DECLARE r jsonb; oid text; i "inventory"%ROWTYPE; BEGIN
  r := pal_place_order('{"customerId":"c2","email":"maria@example.com","phone":"0918","method":"COD","shippingCentavos":10000,"ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v2","qty":3}]}');
  oid := r->>'orderId';
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v2'; PERFORM _assert(i."reserved"=3,'v2 reserved 3');
  PERFORM pal_cancel_order(oid,'Changed mind','adm1');
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v2'; PERFORM _assert(i."reserved"=0 AND i."onHand"=199,'reservation released');
  r := pal_place_order('{"customerId":"c2","email":"maria@example.com","phone":"0918","method":"COD","shippingCentavos":10000,"ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v2","qty":3}]}');
  oid := r->>'orderId';
  PERFORM pal_confirm_order(oid,'adm1',false);
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v2'; PERFORM _assert(i."onHand"=196,'COD confirmed deducts stock');
  PERFORM _assert((SELECT "paymentStatus" FROM "orders" WHERE id=oid)='PENDING','COD not paid yet');
  PERFORM pal_cancel_order(oid,'Customer unreachable','adm1');
  SELECT * INTO i FROM "inventory" WHERE "variantId"='v2'; PERFORM _assert(i."onHand"=199 AND i."unitsSold"=1,'cancel after confirm restocks');
  BEGIN PERFORM pal_cancel_order(oid,'again','adm1'); RAISE EXCEPTION 'TEST FAILED: double cancel';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END $$;

-- 5. Discounts
DO $$ DECLARE r jsonb; o "orders"%ROWTYPE; BEGIN
  r := pal_place_order('{"customerId":"c2","email":"maria@example.com","phone":"0918","method":"GCASH","shippingCentavos":10000,"discountCode":"welcome10","ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v1","qty":1}]}');
  SELECT * INTO o FROM "orders" WHERE id=r->>'orderId'; PERFORM _assert(o."discountCentavos"=45000 AND o."totalCentavos"=415000,'WELCOME10 = 10% off');
  BEGIN PERFORM pal_place_order('{"customerId":"c2","email":"maria@example.com","phone":"0918","method":"GCASH","shippingCentavos":0,"discountCode":"WELCOME10","ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v1","qty":1}]}'); RAISE EXCEPTION 'TEST FAILED: per-customer limit';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM NOT LIKE 'DISCOUNT_INVALID%' THEN RAISE; END IF; END;
  r := pal_place_order('{"customerId":"c1","email":"juan@example.com","phone":"0917","method":"GCASH","shippingCentavos":0,"discountCode":"PALLADIUM500","ship":{"name":"T","phone":"0917","line1":"1 St","barangay":"B","city":"C","province":"Metro Manila","postalCode":"1000"},"items":[{"variantId":"v1","qty":1},{"variantId":"v2","qty":2}]}');
  SELECT * INTO o FROM "orders" WHERE id=r->>'orderId'; PERFORM _assert(o."discountCentavos"=50000 AND o."totalCentavos"=470000,'PALLADIUM500 = 500 pesos off');
  PERFORM _assert((SELECT sum("discountCentavos") FROM "order_items" WHERE "orderId"=o.id)=50000,'line discounts sum to order discount');
  PERFORM pal_cancel_order(o.id,'test','adm1');
  PERFORM _assert((SELECT "timesUsed" FROM "discounts" WHERE code='PALLADIUM500')=0,'cancel returns discount usage');
END $$;

-- 6. Inventory ledger example: 100, -3, +50, -1 => 146
DO $$ DECLARE cur int; BEGIN
  INSERT INTO "product_variants"(id,"productId",name,sku,"priceCentavos","updatedAt") VALUES ('v9','p1','Limited','KORU-LTD',550000,now());
  PERFORM pal_adjust_inventory('v9',NULL,'RECEIVE',100,'Start','adm1');
  PERFORM pal_adjust_inventory('v9',NULL,'REMOVE',3,'Sold','adm1');
  PERFORM pal_adjust_inventory('v9',NULL,'RECEIVE',50,'Restock','adm1');
  PERFORM pal_adjust_inventory('v9',NULL,'DAMAGED',1,'Dropped','adm1');
  SELECT "onHand" INTO cur FROM "inventory" WHERE "variantId"='v9'; PERFORM _assert(cur=146,'ledger example = 146, got '||cur);
  PERFORM pal_adjust_inventory('v9',NULL,'ADJUST',140,'Stock take','adm1');
  SELECT "onHand" INTO cur FROM "inventory" WHERE "variantId"='v9'; PERFORM _assert(cur=140,'adjust to counted 140');
  PERFORM _assert((SELECT sum(quantity) FROM "inventory_transactions" WHERE "variantId"='v9')=140,'ledger sums to on-hand');
  INSERT INTO "locations"(id,name,code,type) VALUES ('loc2','Partner store','RPN1','STORE');
  PERFORM pal_transfer_inventory('v9','loc1','loc2',10,'Consign','adm1');
  PERFORM _assert((SELECT "onHand" FROM "inventory" WHERE "variantId"='v9' AND "locationId"='loc2')=10,'transfer in');
  PERFORM _assert((SELECT "onHand" FROM "inventory" WHERE "variantId"='v9' AND "locationId"='loc1')=130,'transfer out');
END $$;

-- 7. Immutability rules
DO $$ BEGIN
  BEGIN UPDATE "inventory_transactions" SET quantity=0; RAISE EXCEPTION 'TEST FAILED: ledger updated'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM "inventory_transactions"; RAISE EXCEPTION 'TEST FAILED: ledger deleted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END;
  BEGIN DELETE FROM "orders"; RAISE EXCEPTION 'TEST FAILED: order deleted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'TEST FAILED%' THEN RAISE; END IF; END;
  BEGIN INSERT INTO "customers"(id,email,name,"updatedAt") VALUES ('cx','not-an-email','X',now()); RAISE EXCEPTION 'TEST FAILED: bad email'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO "product_variants"(id,"productId",name,sku,"priceCentavos","updatedAt") VALUES ('vx','p1','dup','KORU-STD',1,now()); RAISE EXCEPTION 'TEST FAILED: dup sku'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;

-- 8. Notifications and reports basics
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM "notifications" WHERE kind='NEW_ORDER')>=1,'new order notification');
  PERFORM _assert((SELECT count(*) FROM "notifications" WHERE kind='PAYMENT_RECEIVED')=1,'payment notification');
  PERFORM _assert((SELECT count(*) FROM "inventory_transactions" WHERE action='SALE')>=1,'sale in ledger');
END $$;
SELECT 'ALL DATABASE WORKFLOW TESTS PASSED' AS result;
ROLLBACK;
