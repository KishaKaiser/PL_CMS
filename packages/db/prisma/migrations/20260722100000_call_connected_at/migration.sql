-- When a call's two legs were bridged; talk time and the free period before
-- billing starts are measured from here. Idempotent: safe to re-run.

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP(3);
