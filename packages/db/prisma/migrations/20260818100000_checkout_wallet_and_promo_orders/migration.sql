-- Paying for an order from the wallet balance, and buying the new customer promotion through the normal checkout.
-- Idempotent: safe to re-run.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "walletAppliedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "walletReleasedAt" TIMESTAMP(3);

ALTER TABLE "promo_claims" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "promo_claims_orderId_key" ON "promo_claims"("orderId");
