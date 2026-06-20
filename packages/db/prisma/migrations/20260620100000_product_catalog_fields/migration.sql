ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "regularPrice" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "salePrice" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "saleStartsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "saleEndsAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "weightOz" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "lengthIn" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "widthIn" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "heightIn" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "stockStatus" TEXT NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
ADD COLUMN IF NOT EXISTS "featuredMediaId" TEXT;

UPDATE "products" SET "regularPrice" = "price" WHERE "regularPrice" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_featuredMediaId_fkey'
  ) THEN
    ALTER TABLE "products"
    ADD CONSTRAINT "products_featuredMediaId_fkey"
    FOREIGN KEY ("featuredMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "products_featuredMediaId_idx" ON "products"("featuredMediaId");

CREATE TABLE IF NOT EXISTS "_CategoryToProduct" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_CategoryToProduct_AB_unique" ON "_CategoryToProduct"("A", "B");
CREATE INDEX IF NOT EXISTS "_CategoryToProduct_B_index" ON "_CategoryToProduct"("B");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_CategoryToProduct_A_fkey'
  ) THEN
    ALTER TABLE "_CategoryToProduct"
    ADD CONSTRAINT "_CategoryToProduct_A_fkey"
    FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_CategoryToProduct_B_fkey'
  ) THEN
    ALTER TABLE "_CategoryToProduct"
    ADD CONSTRAINT "_CategoryToProduct_B_fkey"
    FOREIGN KEY ("B") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "_ProductToTag" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_ProductToTag_AB_unique" ON "_ProductToTag"("A", "B");
CREATE INDEX IF NOT EXISTS "_ProductToTag_B_index" ON "_ProductToTag"("B");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_ProductToTag_A_fkey'
  ) THEN
    ALTER TABLE "_ProductToTag"
    ADD CONSTRAINT "_ProductToTag_A_fkey"
    FOREIGN KEY ("A") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = '_ProductToTag_B_fkey'
  ) THEN
    ALTER TABLE "_ProductToTag"
    ADD CONSTRAINT "_ProductToTag_B_fkey"
    FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
