-- Saved PayPal wallets and in-call top-ups. Idempotent: safe to re-run.

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "topUpDeclinedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "paypal_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "payerEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paypal_wallets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_wallets_userId_key" ON "paypal_wallets"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_wallets_vaultId_key" ON "paypal_wallets"("vaultId");

CREATE TABLE IF NOT EXISTS "paypal_wallet_setups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setupTokenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "paypal_wallet_setups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "paypal_wallet_setups_setupTokenId_key" ON "paypal_wallet_setups"("setupTokenId");
CREATE INDEX IF NOT EXISTS "paypal_wallet_setups_userId_createdAt_idx" ON "paypal_wallet_setups"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "wallet_top_ups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'CALL',
    "callSessionId" TEXT,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "wallet_top_ups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_top_ups_paypalCaptureId_key" ON "wallet_top_ups"("paypalCaptureId");
CREATE INDEX IF NOT EXISTS "wallet_top_ups_userId_createdAt_idx" ON "wallet_top_ups"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paypal_wallets_userId_fkey') THEN
    ALTER TABLE "paypal_wallets" ADD CONSTRAINT "paypal_wallets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'paypal_wallet_setups_userId_fkey') THEN
    ALTER TABLE "paypal_wallet_setups" ADD CONSTRAINT "paypal_wallet_setups_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_top_ups_userId_fkey') THEN
    ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
