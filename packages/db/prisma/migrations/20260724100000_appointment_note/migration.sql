-- Why an appointment was missed or expired, shown to both parties.
-- Idempotent: safe to re-run.

ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "note" TEXT;
