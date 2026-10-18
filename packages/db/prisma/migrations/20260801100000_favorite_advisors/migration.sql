-- Clients' favourite advisors. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "favorite_advisors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorite_advisors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "favorite_advisors_userId_advisorId_key" ON "favorite_advisors"("userId", "advisorId");
CREATE INDEX IF NOT EXISTS "favorite_advisors_userId_createdAt_idx" ON "favorite_advisors"("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_advisors_userId_fkey') THEN
    ALTER TABLE "favorite_advisors" ADD CONSTRAINT "favorite_advisors_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorite_advisors_advisorId_fkey') THEN
    ALTER TABLE "favorite_advisors" ADD CONSTRAINT "favorite_advisors_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
