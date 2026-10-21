-- Cancelling an advisor's onboarding. Idempotent: safe to re-run.

ALTER TABLE "advisor_onboardings" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "advisor_onboardings" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
