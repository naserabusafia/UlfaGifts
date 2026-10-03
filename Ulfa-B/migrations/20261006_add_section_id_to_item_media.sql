BEGIN;

-- Each media file (image, voice note, ...) belongs to a section of the item.
-- Nullable so existing rows keep working; new uploads must provide a section.
ALTER TABLE "item_media"
  ADD COLUMN IF NOT EXISTS "section_id" uuid NULL;

ALTER TABLE "item_media"
  ADD CONSTRAINT "FK_item_media_section_id"
  FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT;

CREATE INDEX "IDX_item_media_item_id_section_id"
  ON "item_media" ("item_id", "section_id", "display_order");

COMMIT;
