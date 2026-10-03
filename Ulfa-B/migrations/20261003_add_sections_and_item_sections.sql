BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "sections" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "key" character varying NOT NULL,
  "name" character varying NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_sections_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_sections_key" UNIQUE ("key")
);

CREATE TABLE "item_sections" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "item_id" uuid NOT NULL,
  "section_id" uuid NOT NULL,
  "display_order" integer NOT NULL,
  "is_visible" boolean NOT NULL DEFAULT true,
  CONSTRAINT "PK_item_sections_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_item_sections_item_id_section_id"
    UNIQUE ("item_id", "section_id"),
  CONSTRAINT "FK_item_sections_item_id"
    FOREIGN KEY ("item_id") REFERENCES "nfc_items"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_item_sections_section_id"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT
);

CREATE INDEX "IDX_item_sections_item_id_display_order"
  ON "item_sections" ("item_id", "display_order");

COMMIT;
