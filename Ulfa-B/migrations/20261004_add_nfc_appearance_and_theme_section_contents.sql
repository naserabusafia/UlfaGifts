BEGIN;

ALTER TABLE "nfc_items"
  ADD COLUMN IF NOT EXISTS "theme" varchar(64) NOT NULL DEFAULT 'romantic',
  ADD COLUMN IF NOT EXISTS "language" varchar(16) NOT NULL DEFAULT 'en';

CREATE TABLE "theme_section_contents" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "theme" varchar(64) NOT NULL,
  "language" varchar(16) NOT NULL,
  "section_id" uuid NOT NULL,
  "title" varchar NULL,
  "message" text NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_theme_section_contents_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_theme_section_contents_theme_language_section"
    UNIQUE ("theme", "language", "section_id"),
  CONSTRAINT "FK_theme_section_contents_section_id"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE
);

CREATE INDEX "IDX_theme_section_contents_theme_language"
  ON "theme_section_contents" ("theme", "language");

COMMIT;
