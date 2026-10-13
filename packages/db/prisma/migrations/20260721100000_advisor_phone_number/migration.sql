-- The advisor's own phone number, dialed to connect them to a client.
-- Idempotent: safe to re-run.

ALTER TABLE "advisor_profiles" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
