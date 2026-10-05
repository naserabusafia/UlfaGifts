BEGIN;

-- A theme is the visual style (luxury, casual). Each theme offers occasions
-- (romantic, birthday, ...). An NFC item picks one occasion, and through it a
-- theme. Section copy belongs to an occasion + language.

CREATE TABLE IF NOT EXISTS "themes" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "key" varchar(64) NOT NULL,
  "name" varchar NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_themes_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_themes_key" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "theme_occasions" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "theme_id" uuid NOT NULL,
  "key" varchar(64) NOT NULL,
  "name" varchar NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_theme_occasions_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_theme_occasions_theme_id_key" UNIQUE ("theme_id", "key"),
  CONSTRAINT "FK_theme_occasions_theme_id"
    FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE
);

-- Default sections copied into item_sections when an item is created.
CREATE TABLE IF NOT EXISTS "occasion_sections" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "occasion_id" uuid NOT NULL,
  "section_id" uuid NOT NULL,
  "display_order" integer NOT NULL,
  CONSTRAINT "PK_occasion_sections_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_occasion_sections_occasion_id_section_id" UNIQUE ("occasion_id", "section_id"),
  CONSTRAINT "FK_occasion_sections_occasion_id"
    FOREIGN KEY ("occasion_id") REFERENCES "theme_occasions"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_occasion_sections_section_id"
    FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IDX_occasion_sections_occasion_id_display_order"
  ON "occasion_sections" ("occasion_id", "display_order");

INSERT INTO "themes" ("key", "name") VALUES
  ('luxury', 'Luxury'),
  ('casual', 'Casual')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "theme_occasions" ("theme_id", "key", "name")
SELECT theme.id, occasion.key, occasion.name
FROM (VALUES
  ('luxury', 'romantic', 'Romantic'),
  ('luxury', 'birthday', 'Birthday'),
  ('luxury', 'anniversary', 'Anniversary'),
  ('casual', 'birthday', 'Birthday'),
  ('casual', 'friendship', 'Friendship')
) AS occasion(theme_key, key, name)
JOIN "themes" AS theme ON theme.key = occasion.theme_key
ON CONFLICT ("theme_id", "key") DO NOTHING;

-- nfc_items: theme varchar -> occasion_id. Old theme values that match a luxury
-- occasion key keep it; anything else (romantic, DEFAULT, ...) becomes luxury/romantic.
ALTER TABLE "nfc_items" ADD COLUMN IF NOT EXISTS "occasion_id" uuid NULL;

UPDATE "nfc_items" AS item
SET "occasion_id" = COALESCE(
  (SELECT o.id FROM "theme_occasions" o JOIN "themes" t ON t.id = o.theme_id
    WHERE t.key = 'luxury' AND o.key = item.theme),
  (SELECT o.id FROM "theme_occasions" o JOIN "themes" t ON t.id = o.theme_id
    WHERE t.key = 'luxury' AND o.key = 'romantic'))
WHERE item."occasion_id" IS NULL;

ALTER TABLE "nfc_items" ALTER COLUMN "occasion_id" SET NOT NULL;
ALTER TABLE "nfc_items" ADD CONSTRAINT "FK_nfc_items_occasion_id"
  FOREIGN KEY ("occasion_id") REFERENCES "theme_occasions"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "IDX_nfc_items_occasion_id" ON "nfc_items" ("occasion_id");
ALTER TABLE "nfc_items" DROP COLUMN IF EXISTS "theme";

-- theme_section_contents -> occasion_section_contents, keyed by occasion.
ALTER TABLE "theme_section_contents" RENAME TO "occasion_section_contents";
ALTER TABLE "occasion_section_contents" ADD COLUMN "occasion_id" uuid NULL;

UPDATE "occasion_section_contents" AS content
SET "occasion_id" = COALESCE(
  (SELECT o.id FROM "theme_occasions" o JOIN "themes" t ON t.id = o.theme_id
    WHERE t.key = 'luxury' AND o.key = content.theme),
  (SELECT o.id FROM "theme_occasions" o JOIN "themes" t ON t.id = o.theme_id
    WHERE t.key = 'luxury' AND o.key = 'romantic'));

-- Several old themes (romantic, DEFAULT) can land on the same occasion; keep one
-- row per occasion/language/section, preferring the exact match, then the newest.
DELETE FROM "occasion_section_contents"
WHERE "id" IN (
  SELECT ranked.id FROM (
    SELECT c.id, row_number() OVER (
      PARTITION BY c.occasion_id, c.language, c.section_id
      ORDER BY (c.theme = o.key) DESC, c.updated_at DESC
    ) AS position
    FROM "occasion_section_contents" c
    JOIN "theme_occasions" o ON o.id = c.occasion_id
  ) AS ranked
  WHERE ranked.position > 1
);

ALTER TABLE "occasion_section_contents"
  DROP CONSTRAINT IF EXISTS "UQ_theme_section_contents_theme_language_section";
DROP INDEX IF EXISTS "IDX_theme_section_contents_theme_language";
ALTER TABLE "occasion_section_contents" DROP COLUMN "theme";
-- The section FK was created by TypeORM synchronize with a generated name.
DO $$
DECLARE fk text;
BEGIN
  SELECT conname INTO fk FROM pg_constraint
  WHERE conrelid = 'occasion_section_contents'::regclass AND contype = 'f'
    AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (section_id)%';
  IF fk IS NOT NULL AND fk <> 'FK_occasion_section_contents_section_id' THEN
    EXECUTE format('ALTER TABLE occasion_section_contents RENAME CONSTRAINT %I TO %I',
      fk, 'FK_occasion_section_contents_section_id');
  END IF;
END $$;
ALTER TABLE "occasion_section_contents" ALTER COLUMN "occasion_id" SET NOT NULL;
ALTER TABLE "occasion_section_contents" ADD CONSTRAINT "FK_occasion_section_contents_occasion_id"
  FOREIGN KEY ("occasion_id") REFERENCES "theme_occasions"("id") ON DELETE CASCADE;
ALTER TABLE "occasion_section_contents" ADD CONSTRAINT "UQ_occasion_section_contents_occasion_language_section"
  UNIQUE ("occasion_id", "language", "section_id");
CREATE INDEX IF NOT EXISTS "IDX_occasion_section_contents_occasion_language"
  ON "occasion_section_contents" ("occasion_id", "language");

COMMIT;
