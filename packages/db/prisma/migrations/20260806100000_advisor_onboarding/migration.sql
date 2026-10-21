-- Advisor applications, onboarding and the encrypted onboarding documents. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "advisor_applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "gifts" TEXT NOT NULL,
    "readingStyle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "userId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisor_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_applications_userId_key" ON "advisor_applications"("userId");
CREATE INDEX IF NOT EXISTS "advisor_applications_status_createdAt_idx" ON "advisor_applications"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "advisor_applications_email_idx" ON "advisor_applications"("email");

CREATE TABLE IF NOT EXISTS "advisor_onboardings" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "applicationId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "displayNameChosenAt" TIMESTAMP(3),
    "rateSetAt" TIMESTAMP(3),
    "paymentChosenAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisor_onboardings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_onboardings_advisorId_key" ON "advisor_onboardings"("advisorId");
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_onboardings_applicationId_key" ON "advisor_onboardings"("applicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "advisor_onboardings_tokenHash_key" ON "advisor_onboardings"("tokenHash");

CREATE TABLE IF NOT EXISTS "onboarding_documents" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    CONSTRAINT "onboarding_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "onboarding_documents_advisorId_type_supersededAt_idx" ON "onboarding_documents"("advisorId", "type", "supersededAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_onboardings_advisorId_fkey') THEN
    ALTER TABLE "advisor_onboardings" ADD CONSTRAINT "advisor_onboardings_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'advisor_onboardings_applicationId_fkey') THEN
    ALTER TABLE "advisor_onboardings" ADD CONSTRAINT "advisor_onboardings_applicationId_fkey"
      FOREIGN KEY ("applicationId") REFERENCES "advisor_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_documents_advisorId_fkey') THEN
    ALTER TABLE "onboarding_documents" ADD CONSTRAINT "onboarding_documents_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "advisor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
