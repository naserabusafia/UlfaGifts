BEGIN;

-- Optional day a photo belongs to; the memory calendar places photos by it.
ALTER TABLE "item_media"
  ADD COLUMN IF NOT EXISTS "memory_date" date NULL;

COMMIT;
