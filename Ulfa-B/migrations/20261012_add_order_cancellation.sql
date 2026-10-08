-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- PostgreSQL versions, so it comes first, on its own.
ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';

BEGIN;

-- When the order was cancelled, and when the buyer's uploads were deleted.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamptz NULL,
  ADD COLUMN IF NOT EXISTS "content_purged_at" timestamptz NULL;

-- Whether an item used a quota unit, so cancelling refunds only what was
-- charged. Existing items were created through merchant orders and were.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "quota_charged" boolean NOT NULL DEFAULT true;

-- Locks added by cancelling an order, undone when the order is restored.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "locked_by_cancel" boolean NOT NULL DEFAULT false;

COMMIT;
