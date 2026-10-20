-- A fee taken from advisor payouts paid by PayPal. Idempotent: safe to re-run.

ALTER TABLE "advisor_payouts" ADD COLUMN IF NOT EXISTS "feeCents" INTEGER NOT NULL DEFAULT 0;
