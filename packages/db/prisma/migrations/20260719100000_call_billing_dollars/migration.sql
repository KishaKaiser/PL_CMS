-- ClientProfile: drop the old minutes-based wallet balance now that
-- balanceCents (added in the previous migration) is the billing source of
-- truth. Confirmed no live client balances depend on the old column.
ALTER TABLE "client_profiles" DROP COLUMN IF EXISTS "balanceMinutes";

-- CallSession: fields needed for real per-minute billing and mid-call
-- hangups (low balance / manual end), which don't happen inside a webhook.
ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "billedAmountCents" INTEGER;
ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "twilioCallSid" TEXT;
ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "nextBillAt" TIMESTAMP(3);
