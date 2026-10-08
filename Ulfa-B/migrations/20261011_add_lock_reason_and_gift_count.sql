BEGIN;

-- Optional note shown to the buyer and the recipient while an item is locked.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "lock_reason" varchar(200) NULL;

-- Number of physical gifts that share an item's link (orders created with
-- one shared link for several gifts). Existing items carry one gift each.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "gift_count" integer NOT NULL DEFAULT 1;

COMMIT;
