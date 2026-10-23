-- Custom candle builder: candle types, heights, colors and herbs, and what a customer chose on an order line.
-- Idempotent: safe to re-run.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "customization" JSONB;

CREATE TABLE IF NOT EXISTS "candle_types" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "basePrice" DECIMAL(65,30) NOT NULL,
  "photoMediaId" TEXT,
  "waxMaskMediaId" TEXT,
  "allowTwoColors" BOOLEAN NOT NULL DEFAULT false,
  "twoColorExtra" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "allowHerbs" BOOLEAN NOT NULL DEFAULT false,
  "weightOz" DECIMAL(65,30),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candle_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "candle_sizes" (
  "id" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "extraPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "heightPercent" INTEGER NOT NULL DEFAULT 100,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "candle_sizes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "candle_colors" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "hex" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "candle_colors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "candle_herbs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "hex" TEXT NOT NULL DEFAULT '#4d7c3a',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "candle_herbs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "candle_types_photoMediaId_idx" ON "candle_types"("photoMediaId");
CREATE INDEX IF NOT EXISTS "candle_types_waxMaskMediaId_idx" ON "candle_types"("waxMaskMediaId");
CREATE INDEX IF NOT EXISTS "candle_sizes_typeId_idx" ON "candle_sizes"("typeId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candle_types_photoMediaId_fkey') THEN
    ALTER TABLE "candle_types" ADD CONSTRAINT "candle_types_photoMediaId_fkey"
      FOREIGN KEY ("photoMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candle_types_waxMaskMediaId_fkey') THEN
    ALTER TABLE "candle_types" ADD CONSTRAINT "candle_types_waxMaskMediaId_fkey"
      FOREIGN KEY ("waxMaskMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candle_sizes_typeId_fkey') THEN
    ALTER TABLE "candle_sizes" ADD CONSTRAINT "candle_sizes_typeId_fkey"
      FOREIGN KEY ("typeId") REFERENCES "candle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
