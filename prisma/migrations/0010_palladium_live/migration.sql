-- Real $PALLADIUM payments: one blockchain transaction can pay one order only.
-- The application checks this before attaching a hash; this index is the hard guarantee under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_txId_unique" ON "orders"("txId") WHERE "txId" IS NOT NULL;
