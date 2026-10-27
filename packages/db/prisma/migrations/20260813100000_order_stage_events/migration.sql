-- Order progress: the steps an order goes through after it is placed (being made, being packaged, ready to ship, shipped,
-- delivered), with when each was reached.
-- Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStage') THEN
    CREATE TYPE "OrderStage" AS ENUM ('IN_PRODUCTION', 'PACKAGING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "order_stage_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "stage" "OrderStage" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_stage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_stage_events_orderId_createdAt_idx" ON "order_stage_events"("orderId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_stage_events_orderId_fkey') THEN
    ALTER TABLE "order_stage_events"
      ADD CONSTRAINT "order_stage_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
