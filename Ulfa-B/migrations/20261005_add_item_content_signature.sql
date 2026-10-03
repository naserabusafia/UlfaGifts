BEGIN;

-- Per-item letter ("رسالة البدء"): title = greeting, message = body, signature = sign-off
ALTER TABLE "item_contents"
  ADD COLUMN IF NOT EXISTS "signature" varchar NULL;

COMMIT;
