CREATE TABLE IF NOT EXISTS "astrology_charts" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "inputData" JSONB NOT NULL,
  "chartData" JSONB NOT NULL,
  "resultData" JSONB,
  "aiText" TEXT,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "astrology_charts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "astrology_charts_createdById_idx" ON "astrology_charts"("createdById");
CREATE INDEX IF NOT EXISTS "astrology_charts_reportType_idx" ON "astrology_charts"("reportType");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'astrology_charts_createdById_fkey'
  ) THEN
    ALTER TABLE "astrology_charts"
    ADD CONSTRAINT "astrology_charts_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
