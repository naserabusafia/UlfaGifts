BEGIN;

-- Merchants on a limited quota ask for more links; an admin approves (with the
-- amount asked for or a different one) or rejects. Either side may add a reason.
CREATE TABLE IF NOT EXISTS "quota_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requested_amount" integer NOT NULL,
  "approved_amount" integer NULL,
  "status" varchar(20) NOT NULL DEFAULT 'PENDING',
  "merchant_reason" varchar(500) NULL,
  "admin_reason" varchar(500) NULL,
  "reviewed_by_id" uuid NULL REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_quota_requests_merchant_id"
  ON "quota_requests" ("merchant_id");
CREATE INDEX IF NOT EXISTS "IDX_quota_requests_status_created_at"
  ON "quota_requests" ("status", "created_at");

COMMIT;
