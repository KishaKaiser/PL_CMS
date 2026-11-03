-- The new customer promotion: one claim per client and per internet address (see PromoClaim in schema.prisma).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "promo_claims" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "minutes" INTEGER NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "ipKey" TEXT,
  "clientKey" TEXT,
  "paypalOrderId" TEXT,
  "captureId" TEXT,
  "payerEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "promo_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "promo_claims_ipKey_key" ON "promo_claims"("ipKey");
CREATE UNIQUE INDEX IF NOT EXISTS "promo_claims_clientKey_key" ON "promo_claims"("clientKey");
CREATE UNIQUE INDEX IF NOT EXISTS "promo_claims_paypalOrderId_key" ON "promo_claims"("paypalOrderId");
CREATE INDEX IF NOT EXISTS "promo_claims_clientId_idx" ON "promo_claims"("clientId");
CREATE INDEX IF NOT EXISTS "promo_claims_createdAt_idx" ON "promo_claims"("createdAt");

DO $$ BEGIN
  ALTER TABLE "promo_claims" ADD CONSTRAINT "promo_claims_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
