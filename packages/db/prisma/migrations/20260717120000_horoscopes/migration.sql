CREATE TABLE IF NOT EXISTS "horoscopes" (
  "id" TEXT NOT NULL,
  "sign" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "overview" TEXT NOT NULL,
  "career" TEXT NOT NULL,
  "money" TEXT NOT NULL,
  "love" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "horoscopes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "horoscopes_sign_year_month_key" ON "horoscopes"("sign", "year", "month");
CREATE INDEX IF NOT EXISTS "horoscopes_year_month_idx" ON "horoscopes"("year", "month");
