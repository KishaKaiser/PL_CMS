ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;

CREATE TABLE IF NOT EXISTS "product_reviews" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_reviews_productId_userId_key" ON "product_reviews"("productId", "userId");
CREATE INDEX IF NOT EXISTS "product_reviews_productId_idx" ON "product_reviews"("productId");
CREATE INDEX IF NOT EXISTS "product_reviews_userId_idx" ON "product_reviews"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_productId_fkey'
  ) THEN
    ALTER TABLE "product_reviews"
      ADD CONSTRAINT "product_reviews_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_userId_fkey'
  ) THEN
    ALTER TABLE "product_reviews"
      ADD CONSTRAINT "product_reviews_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "post_comments_postId_userId_key" ON "post_comments"("postId", "userId");
CREATE INDEX IF NOT EXISTS "post_comments_postId_idx" ON "post_comments"("postId");
CREATE INDEX IF NOT EXISTS "post_comments_userId_idx" ON "post_comments"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_postId_fkey'
  ) THEN
    ALTER TABLE "post_comments"
      ADD CONSTRAINT "post_comments_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_userId_fkey'
  ) THEN
    ALTER TABLE "post_comments"
      ADD CONSTRAINT "post_comments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
