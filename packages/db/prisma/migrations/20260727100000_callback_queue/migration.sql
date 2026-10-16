-- Callback queue: a queue spot remembers why it ended and which call was placed for it.
-- Idempotent: safe to re-run.

ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "callSessionId" TEXT;
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "queue_assignments" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "queue_assignments_callSessionId_key" ON "queue_assignments"("callSessionId");
CREATE INDEX IF NOT EXISTS "queue_assignments_clientId_status_idx" ON "queue_assignments"("clientId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'queue_assignments_callSessionId_fkey'
  ) THEN
    ALTER TABLE "queue_assignments"
    ADD CONSTRAINT "queue_assignments_callSessionId_fkey"
    FOREIGN KEY ("callSessionId") REFERENCES "call_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
