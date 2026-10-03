BEGIN;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "customer_phone" varchar(16);

CREATE INDEX IF NOT EXISTS "IDX_orders_customer_phone"
  ON "orders" ("customer_phone");

ALTER TABLE "nfc_items"
  DROP COLUMN IF EXISTS "owner_email";

COMMIT;
