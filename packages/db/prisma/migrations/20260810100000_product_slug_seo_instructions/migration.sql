-- Product web addresses (slugs), search engine fields and an instructions PDF. Idempotent: safe to re-run.
-- (Existing products get their slug from the app when the API starts, because the deploy applies schema changes
-- with `prisma db push`, which does not run data fixes in migration files.)

ALTER TYPE "RedirectContentType" ADD VALUE IF NOT EXISTS 'PRODUCT';

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "instructionsMediaId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");
CREATE INDEX IF NOT EXISTS "products_instructionsMediaId_idx" ON "products"("instructionsMediaId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_instructionsMediaId_fkey') THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_instructionsMediaId_fkey"
      FOREIGN KEY ("instructionsMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
