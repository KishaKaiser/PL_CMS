-- Redial once when a scheduled call is not answered: count the calls placed and
-- remember when the redial is due. Idempotent: safe to re-run.

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
