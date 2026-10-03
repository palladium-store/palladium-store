-- $PALLADIUM DEMO payment (simulated, no blockchain).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'PALLADIUM';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tokenAmountMinor" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tokenPriceCentavos" INTEGER;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "txId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "walletAddress" TEXT;
CREATE INDEX IF NOT EXISTS "orders_paymentMode_idx" ON "orders"("paymentMode");
