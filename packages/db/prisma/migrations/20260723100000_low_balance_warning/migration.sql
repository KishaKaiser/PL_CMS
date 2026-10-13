-- When the "balance is running low" warning was spoken on a call, so it is
-- only played once per shortage. Idempotent: safe to re-run.

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "lowBalanceWarnedAt" TIMESTAMP(3);
