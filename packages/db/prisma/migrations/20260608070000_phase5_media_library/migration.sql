CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "altText" TEXT,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

ALTER TABLE "pages"
ADD COLUMN "featuredMediaId" TEXT;

ALTER TABLE "posts"
ADD COLUMN "featuredMediaId" TEXT;

CREATE INDEX "pages_featuredMediaId_idx" ON "pages"("featuredMediaId");
CREATE INDEX "posts_featuredMediaId_idx" ON "posts"("featuredMediaId");

ALTER TABLE "pages"
ADD CONSTRAINT "pages_featuredMediaId_fkey" FOREIGN KEY ("featuredMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "posts"
ADD CONSTRAINT "posts_featuredMediaId_fkey" FOREIGN KEY ("featuredMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
