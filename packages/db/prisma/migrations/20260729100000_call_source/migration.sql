-- Remember how each call started so the admin call log can show it. Idempotent: safe to re-run.

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'DIRECT';
CREATE INDEX IF NOT EXISTS "call_sessions_startedAt_idx" ON "call_sessions"("startedAt");
