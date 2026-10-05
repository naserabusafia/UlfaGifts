BEGIN;

-- Buyer setup flow with end-to-end encryption. The server stores only the
-- content key wrapped by keys the browser derives from the viewer answer and
-- the recovery code; media objects and letter text are ciphertext.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "key_salt" varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS "kdf_iterations" integer NULL,
  ADD COLUMN IF NOT EXISTS "wrapped_key" varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS "recovery_wrapped_key" varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS "recovery_hash" varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS "published_at" timestamptz NULL;

ALTER TABLE "item_media"
  ALTER COLUMN "url" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "storage_key" varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS "thumb_key" varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS "mime" varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS "bytes" integer NULL,
  ADD COLUMN IF NOT EXISTS "thumb_bytes" integer NULL,
  ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

ALTER TABLE "item_contents"
  ADD COLUMN IF NOT EXISTS "is_encrypted" boolean NOT NULL DEFAULT false;

COMMIT;
