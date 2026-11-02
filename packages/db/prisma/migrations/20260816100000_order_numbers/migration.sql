-- A short order number customers can use (shown as the store's prefix and this number plus 1000, for example PL-1042).
-- Orders that already exist are numbered by the database as the column is added.
-- Idempotent: safe to re-run.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "orderNumber" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_orderNumber_key" ON "orders"("orderNumber");
