-- Click-to-call over Telnyx Call Control: the client's callable phone number,
-- and one call-control id per leg instead of Twilio's single CallSid.
-- Idempotent: safe to re-run.

ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "clientCallControlId" TEXT;
ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "advisorCallControlId" TEXT;
ALTER TABLE "call_sessions" DROP COLUMN IF EXISTS "twilioCallSid";
