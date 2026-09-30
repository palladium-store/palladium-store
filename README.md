# PALLADIUM — E-commerce + Admin

Next.js 14 (App Router) · TypeScript · Tailwind · PostgreSQL · Prisma. Philippines (PHP ₱, Asia/Manila).

## Quick start
```bash
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET (>=32 chars), SEED_ADMIN_EMAIL/PASSWORD
npm install
npx prisma generate
npx prisma migrate deploy   # applies prisma/migrations (0001 tables, 0002 constraints/triggers, 0003 pal_* functions)
npm run db:seed             # SEED_DEMO=false to skip demo data
npm run dev                 # http://localhost:3000  ·  admin: /admin
```
Demo customer after seeding: `customer@example.com` / `Customer!2026`. Admin = the SEED_ADMIN_* values.

## Architecture
- Stock and order rules live in PostgreSQL functions (`pal_place_order`, `pal_confirm_order`, `pal_cancel_order`, `pal_refund_order`, `pal_adjust_inventory`, `pal_transfer_inventory`): atomic, row-locked, idempotent. Ledger table `inventory_transactions` is append-only (trigger-enforced). No negative stock unless overselling is enabled.
- Money is integer centavos. Dates stored UTC, reported in Asia/Manila.
- Auth: JWT cookie + bcrypt, RBAC (Super Admin, Admin, Inventory Manager, Order Manager, Staff), audit log.
- Payments: manual provider (admin confirms GCash/Maya/card/bank payments); `src/lib/payments.ts` + `/api/payments/webhook` are the integration points for PayMongo/Xendit etc.
- Storage: `src/lib/storage.ts` writes to `UPLOAD_DIR`; swap for S3/R2 by replacing the driver.
- Email: queued in `notifications`, sent by `GET /api/cron/outbox` with header `Authorization: Bearer $CRON_SECRET` (schedule every minute). Without SMTP_* it logs instead.
- Future-ready: `locations` + per-location `inventory`, `Shipment`, `source` fields allow consignment/POS/multi-warehouse without schema rewrites.

See docs/ARCHITECTURE.md for detail.

## Tests
- `bash docs/run_db_tests.sh` — DB workflow tests on real PostgreSQL (order, oversell, cancel, refund, discounts, ledger).
- `npm run typecheck && npm run build` — must be run once dependencies are installed.
- `node tests/syntax-check.cjs` / `node tests/import-check.cjs` — offline sanity checks.

## Deploy checklist
1. Managed PostgreSQL; set `DATABASE_URL`, strong `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, SMTP_*.
2. `prisma migrate deploy`, seed once (create real admin, then `SEED_DEMO=false`).
3. Persistent volume (or object storage) for uploads.
4. Cron hitting `/api/cron/outbox`.
5. Change the seeded admin password; delete demo products in Admin → Products (flagged DEMO).
