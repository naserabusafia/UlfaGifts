BEGIN;

-- Brute-force protection for the viewer answer: after 5 wrong answers the
-- item refuses further attempts until locked_until.
ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "failed_attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" timestamptz NULL;

-- viewer_password_hash now holds bcrypt hashes ($2b$...). Existing SHA-256
-- hex hashes keep working and are upgraded on the next correct answer.

COMMIT;
