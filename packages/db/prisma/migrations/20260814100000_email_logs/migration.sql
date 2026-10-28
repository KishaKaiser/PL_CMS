-- Email: a record of each email the site tried to send (sent or failed) for the admin Email page, and a marker on orders so
-- the order confirmation is sent once. Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailStatus') THEN
    CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'general',
  "status" "EmailStatus" NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- Marks that the order confirmation email was sent, so it goes out once even if payment is confirmed twice.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirmationEmailSentAt" TIMESTAMP(3);
