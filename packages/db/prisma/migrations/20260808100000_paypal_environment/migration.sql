-- Remember which PayPal (sandbox or live) a saved wallet, a wallet setup and a top-up belong to. Idempotent: safe to re-run.
-- Everything saved before this was recorded was made while testing, so it is marked sandbox.

ALTER TABLE "paypal_wallets" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE "paypal_wallet_setups" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE "wallet_top_ups" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'sandbox';
