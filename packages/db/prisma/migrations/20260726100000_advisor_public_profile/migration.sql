-- Public advisor profiles: a URL slug for each advisor and client reviews.
-- Idempotent: safe to re-run.

ALTER TABLE "advisor_profiles" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_profiles_slug_key" ON "advisor_profiles"("slug");

CREATE TABLE IF NOT EXISTS "advisor_reviews" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "advisor_reviews_advisorId_userId_key" ON "advisor_reviews"("advisorId", "userId");
CREATE INDEX IF NOT EXISTS "advisor_reviews_advisorId_createdAt_idx" ON "advisor_reviews"("advisorId", "createdAt");
CREATE INDEX IF NOT EXISTS "advisor_reviews_userId_idx" ON "advisor_reviews"("userId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_reviews_advisorId_fkey') THEN
        ALTER TABLE "advisor_reviews" ADD CONSTRAINT "advisor_reviews_advisorId_fkey"
            FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_reviews_userId_fkey') THEN
        ALTER TABLE "advisor_reviews" ADD CONSTRAINT "advisor_reviews_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
