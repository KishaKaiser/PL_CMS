-- Advisor earnings, payouts and a per-advisor revenue share. Idempotent: safe to re-run.

ALTER TABLE "advisor_profiles" ADD COLUMN IF NOT EXISTS "sharePercent" INTEGER;

CREATE TABLE IF NOT EXISTS "advisor_earnings" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "callSessionId" TEXT NOT NULL,
    "billedMinutes" INTEGER NOT NULL,
    "freeMinutes" INTEGER NOT NULL,
    "chargedCents" INTEGER NOT NULL,
    "sharePercent" INTEGER NOT NULL,
    "earnedCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisor_earnings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_earnings_callSessionId_key" ON "advisor_earnings"("callSessionId");
CREATE INDEX IF NOT EXISTS "advisor_earnings_advisorId_createdAt_idx" ON "advisor_earnings"("advisorId", "createdAt");

CREATE TABLE IF NOT EXISTS "advisor_payouts" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisor_payouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "advisor_payouts_advisorId_paidAt_idx" ON "advisor_payouts"("advisorId", "paidAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_earnings_advisorId_fkey') THEN
    ALTER TABLE "advisor_earnings" ADD CONSTRAINT "advisor_earnings_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_earnings_callSessionId_fkey') THEN
    ALTER TABLE "advisor_earnings" ADD CONSTRAINT "advisor_earnings_callSessionId_fkey"
      FOREIGN KEY ("callSessionId") REFERENCES "call_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_payouts_advisorId_fkey') THEN
    ALTER TABLE "advisor_payouts" ADD CONSTRAINT "advisor_payouts_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
