-- Let a product be hidden from the shop while staying usable. Idempotent: safe to re-run.
-- (The wallet credit product is hidden once by the app itself when it starts, so an admin can show it again later.)

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hiddenFromShop" BOOLEAN NOT NULL DEFAULT false;
