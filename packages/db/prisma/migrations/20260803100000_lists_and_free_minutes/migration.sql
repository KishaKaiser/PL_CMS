-- Advisor contact lists, free call minutes, and a recipient count on admin broadcasts. Idempotent: safe to re-run.

ALTER TABLE "call_sessions" ADD COLUMN IF NOT EXISTS "freeMinutesUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "broadcast_messages" ADD COLUMN IF NOT EXISTS "recipientCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "contact_lists" (
    "id" TEXT NOT NULL,
    "advisorUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_lists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_lists_advisorUserId_name_key" ON "contact_lists"("advisorUserId", "name");

CREATE TABLE IF NOT EXISTS "contact_list_members" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_list_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "contact_list_members_listId_clientUserId_key" ON "contact_list_members"("listId", "clientUserId");
CREATE INDEX IF NOT EXISTS "contact_list_members_clientUserId_idx" ON "contact_list_members"("clientUserId");

CREATE TABLE IF NOT EXISTS "free_minute_grants" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "advisorId" TEXT,
    "minutes" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "note" TEXT,
    "promoKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "free_minute_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "free_minute_grants_clientId_promoKey_key" ON "free_minute_grants"("clientId", "promoKey");
CREATE INDEX IF NOT EXISTS "free_minute_grants_clientId_remaining_idx" ON "free_minute_grants"("clientId", "remaining");
CREATE INDEX IF NOT EXISTS "free_minute_grants_grantedByUserId_createdAt_idx" ON "free_minute_grants"("grantedByUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_lists_advisorUserId_fkey') THEN
    ALTER TABLE "contact_lists" ADD CONSTRAINT "contact_lists_advisorUserId_fkey"
      FOREIGN KEY ("advisorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_list_members_listId_fkey') THEN
    ALTER TABLE "contact_list_members" ADD CONSTRAINT "contact_list_members_listId_fkey"
      FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'free_minute_grants_clientId_fkey') THEN
    ALTER TABLE "free_minute_grants" ADD CONSTRAINT "free_minute_grants_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "client_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'free_minute_grants_advisorId_fkey') THEN
    ALTER TABLE "free_minute_grants" ADD CONSTRAINT "free_minute_grants_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'free_minute_grants_grantedByUserId_fkey') THEN
    ALTER TABLE "free_minute_grants" ADD CONSTRAINT "free_minute_grants_grantedByUserId_fkey"
      FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
