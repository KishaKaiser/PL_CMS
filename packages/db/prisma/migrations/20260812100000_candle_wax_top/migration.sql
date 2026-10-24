-- Where the wax starts on a candle (percent down from the top), so glass candles are not colored up to the rim.
-- Idempotent: safe to re-run.

ALTER TABLE "candle_types" ADD COLUMN IF NOT EXISTS "waxTopPercent" INTEGER NOT NULL DEFAULT 0;
