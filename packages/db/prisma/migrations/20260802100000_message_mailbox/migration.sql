-- Messages become email: a subject, threads, and an inbox / sent / trash folder for each side.
-- Idempotent: safe to re-run.

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "senderFolder" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "recipientFolder" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "messages_threadId_idx" ON "messages"("threadId");
