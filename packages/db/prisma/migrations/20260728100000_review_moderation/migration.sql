-- Admin moderation of advisor reviews: a hidden review stays in the database but is
-- left out of the public profile and the advisor's average. Idempotent: safe to re-run.

ALTER TABLE "advisor_reviews" ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3);
ALTER TABLE "advisor_reviews" ADD COLUMN IF NOT EXISTS "hiddenReason" TEXT;

CREATE INDEX IF NOT EXISTS "advisor_reviews_advisorId_hiddenAt_idx" ON "advisor_reviews"("advisorId", "hiddenAt");
