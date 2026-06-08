ALTER TABLE "pages"
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "metaDescription" TEXT;

ALTER TABLE "posts"
ADD COLUMN "metaTitle" TEXT,
ADD COLUMN "metaDescription" TEXT;

CREATE TYPE "RedirectContentType" AS ENUM ('PAGE', 'POST');

CREATE TABLE "slug_redirects" (
  "id" TEXT NOT NULL,
  "contentType" "RedirectContentType" NOT NULL,
  "sourceSlug" TEXT NOT NULL,
  "targetSlug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "slug_redirects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "slug_redirects_contentType_sourceSlug_key" ON "slug_redirects"("contentType", "sourceSlug");
CREATE INDEX "slug_redirects_contentType_targetSlug_idx" ON "slug_redirects"("contentType", "targetSlug");
