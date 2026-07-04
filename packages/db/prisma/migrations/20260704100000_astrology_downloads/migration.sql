ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "digitalDelivery" TEXT NOT NULL DEFAULT 'NONE';

CREATE TABLE IF NOT EXISTS "astrology_reports" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "formData" JSONB NOT NULL,
  "reportUrl" TEXT,
  "reportText" TEXT,
  "fileName" TEXT,
  "errorMessage" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "astrology_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "astrology_reports_orderItemId_key" ON "astrology_reports"("orderItemId");
CREATE INDEX IF NOT EXISTS "astrology_reports_userId_idx" ON "astrology_reports"("userId");
CREATE INDEX IF NOT EXISTS "astrology_reports_orderId_idx" ON "astrology_reports"("orderId");
CREATE INDEX IF NOT EXISTS "astrology_reports_productId_idx" ON "astrology_reports"("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'astrology_reports_userId_fkey'
  ) THEN
    ALTER TABLE "astrology_reports"
    ADD CONSTRAINT "astrology_reports_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'astrology_reports_orderId_fkey'
  ) THEN
    ALTER TABLE "astrology_reports"
    ADD CONSTRAINT "astrology_reports_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'astrology_reports_orderItemId_fkey'
  ) THEN
    ALTER TABLE "astrology_reports"
    ADD CONSTRAINT "astrology_reports_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'astrology_reports_productId_fkey'
  ) THEN
    ALTER TABLE "astrology_reports"
    ADD CONSTRAINT "astrology_reports_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
