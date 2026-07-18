-- AdvisorProfile: SIP extension for the Grandstream UCM6301, and a queue
-- auto-dialer toggle kept separate from the general isOnline flag.
ALTER TABLE "advisor_profiles" ADD COLUMN IF NOT EXISTS "sipExtension" TEXT;
ALTER TABLE "advisor_profiles" ADD COLUMN IF NOT EXISTS "queueCallingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- ClientProfile: dollar-balance wallet (cents), added alongside the still-live
-- balanceMinutes column so this migration doesn't break current billing.
ALTER TABLE "client_profiles" ADD COLUMN IF NOT EXISTS "balanceCents" INTEGER NOT NULL DEFAULT 0;

-- QueueAssignment: client-chosen max wait time and its computed expiry.
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "maxWaitMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
UPDATE "queue_assignments" SET "expiresAt" = "joinedAt" + INTERVAL '30 minutes' WHERE "expiresAt" IS NULL;
ALTER TABLE "queue_assignments" ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "queue_assignments_queueId_status_idx" ON "queue_assignments"("queueId", "status");

-- Scheduled appointments.
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "callSessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointments_callSessionId_key" ON "appointments"("callSessionId");
CREATE INDEX IF NOT EXISTS "appointments_advisorId_status_idx" ON "appointments"("advisorId", "status");
CREATE INDEX IF NOT EXISTS "appointments_clientId_status_idx" ON "appointments"("clientId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_advisorId_fkey'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_advisorId_fkey"
    FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_clientId_fkey'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointments_callSessionId_fkey'
  ) THEN
    ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_callSessionId_fkey"
    FOREIGN KEY ("callSessionId") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
