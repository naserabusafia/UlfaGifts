# Photo wheel and NFC sections

The renderer maps backend-ordered sections to registered components. A wheel
without display_order uses SECTION_FALLBACK_AFTER.photo_wheel = message; an
explicit order always wins. Empty wheels are omitted.

## Changed / added files

- components/PhotoWheel.tsx: windowed seven-slot reel, seeded pile, progress,
  first-view hint, locale numbers, and accessible photo dialog.
- components/photo-wheel.css: navy/cream section, masked cardboard disk, active
  lift, printed pile, indicator, number placement and reduced-motion styles.
- hooks/useCircularDrag.ts: angular pointer capture, wrap-safe tracking, frame
  updates, snap, bounded momentum and click suppression. Geometry is read once
  on pointerdown; pointermove has no layout reads.
- hooks/useHorizontalDrag.ts: existing lightbox swipe gesture.
- utils/wheel.ts: geometry, windowing, seeded pile placement and tunable constants.
- components/ExperienceSections.tsx and EnvelopeLetter.tsx: reveal sections after
  opening, persistent open letter, one-time generic next-section handoff.
- NfcExperiencePage.tsx and demo/sections.ts: up to 500 preview photos, separate
  thumbnail/full images, and demo-only Arabic/English text and photo captions.
- src/i18n/locales/en.json and ar.json: interface and accessibility labels.
- tests/experience.test.ts and tests/photo-wheel.browser.mjs: geometry, windowing,
  gestures, accessibility, demo, first-view hint and Message regressions.
- Backend nfc-items.service.ts, nfc-items.controller.ts and service spec: exact
  theme/language copy for verified items and a read-only public template endpoint.

## Database content

A theme is the visual style (`themes`: luxury, casual). Each theme offers
occasions (`theme_occasions`: luxury/romantic, luxury/birthday,
luxury/anniversary, casual/birthday, casual/friendship). An item stores only
`nfc_items.occasion_id`; its theme comes from the occasion. Schema change:
`Ulfa-B/migrations/20261008_add_themes_and_occasions.sql`.

| Table | Content |
| --- | --- |
| themes | key, name, is_active. |
| theme_occasions | theme_id, key (unique per theme), name, is_active. |
| occasion_sections | Default sections (section_id, display_order) copied into item_sections when an item is created. |
| occasion_section_contents | occasion_id, language, section_id; title and message. Each translation is fetched exactly, with no language fallback. |
| sections | photo_wheel, voice_note, memory_calendar, film_strip. A message row can configure letter ordering. |
| item_sections | item_id, section_id, display_order and is_visible. |
| item_media | item_id, section_id, media_type, url, display_order, optional caption and memory_date. |
| nfc_items | occasion_id and language. Create/update accept `theme` and `occasion` keys. |

Seed: `Ulfa-B/scripts/occasion-content.sql` (sections, default sections and
Arabic/English copy for every occasion). It inserts only missing rows.

Public API: `GET nfc-items/public/themes` lists active themes and occasions;
`GET nfc-items/public/section-texts/:theme/:occasion/:language/:section` returns
one section's copy. The challenge and verify responses carry `theme`, `occasion`
and `language` keys; the page sets them as `data-theme` / `data-occasion`.

The existing media schema stores one URL and a plain caption. That URL is used
for wheel and full image unless the API supplies optional thumbnailUrl/fullUrl.
There is no localized-caption table. Captions are displayed as stored, safely as
text. No separate thumbnail schema is introduced.

The demo has 30 local photo pairs with Arabic/English sample headings, subtitles,
and captions, as requested for preview. Its copy lives only in demo/sections.ts and
requires no backend requests. Real events continue using the verified DB response,
with text matched to occasion/language and media scoped to the event and section.
The read-only template endpoint remains available but is not used by the demo.

Use /nfc/demo?auth=NONE&lang=ar (optionally &theme=casual&occasion=birthday); photos=1,5,7,8,30,120,250 previews collection sizes
(up to 500). Only the exact demo route uses local photo fixtures. Source credits
are in public/demo/photos/credits.json.

## Tunable constants (utils/wheel.ts)

| Constants | Defaults / purpose |
| --- | --- |
| SLOT_ANGLE, VISIBLE_OFFSET | 45 degrees; offsets -3 through +3. Bottom slot unused. |
| MAX_DIAMETER, DIAMETER_RATIO | min(94% section width, 560px). |
| PHOTO_SIZE_RATIO, NEIGHBOR_SCALE_FALLOFF | 22% diameter; 0 = uniform neighbors. |
| PHOTO_RADIUS_INSET | .72 photo widths inside the rim. |
| ACTIVE_SCALE, ACTIVE_RADIUS_INSET | 1.45; .15 base photo widths inset, about 40% pop-out. |
| HOLE_RATIO, NUMBER_RADIUS_RATIO | 14% hole diameter; number centers at .16 disk diameter. |
| PILE_SIZE_RATIO, PILE_RADIUS_RATIO | .8 slot photo; center .35 diameter below disk center. |
| PILE_FRACTION, PILE_MIN_COUNT, PILE_MAX_COUNT | ceil(remaining * .5), clamped 3-14. |
| PILE_ROTATION, PILE_JITTER_X/Y, PILE_MIN_SCALE | Seeded +/-25 degrees; up to .12/.05 card widths of jitter; depth scales to .85. |
| TRANSITION_MS, TRANSITION_EASING | 450ms, cubic-bezier(.22,.8,.25,1). |
| CLICK_MODE | rotate-then-open; alternative open-any. |
| HINT_DELAY_MS, HINT_PAUSE_MS | 400ms delay; 300ms pause after the two-slot rotation completes. |
| DRAG_ANGLE_THRESHOLD, DRAG_PIXEL_THRESHOLD | 4 degrees / 6px; center-hole starts ignored. |
| MOMENTUM_THRESHOLD, MAX_MOMENTUM_SLOTS | .28 degrees/ms; maximum 3 extra slots. |

The disk, noise and eight 22.5-degree-offset cutouts rotate together. The pile,
progress arc and V/up-arrow indicator remain fixed. Only visible photos plus up
to 14 pile cards mount, even for 250+ photos. Pile cards are keyed by actual photo
id and keep their seeded pose. Forward rotation pulls the top pile photo into
slot +3; reverse rotation returns the outgoing photo to the top of the pile.
For 8/9 photos, the minimum three-card pile can include upcoming photos also in
visible slots, using distinct keys so the wheel slots remain unique.

The first-view hint uses IntersectionObserver at 50% visibility, runs once, and
cancels on any interaction with the section. Reduced motion disables it. The
letter stays unfolded when scrolling back. Auto-scroll runs only once, targets
the next section, and yields to manual page scrolling. The disk alone uses
touch-action:none; the heading, margins and controls allow ordinary page scrolling.

## Validation

Frontend: npm run build, npm test, targeted ESLint. Backend: npm run build and
npm test -- --runInBand nfc-items.service.spec.ts.

Browser: run tests/photo-wheel.browser.mjs with an existing Playwright module in
PLAYWRIGHT_MODULE and optionally TEST_ORIGIN (default http://127.0.0.1:5175).
The harness uses Edge, intercepted DB-shaped responses, 360/390/430/1280px widths,
1/5/7/8/30/120 photos, 250-photo windowing and momentum, native touch, hint lifecycle,
reduced motion, locale/RTL, full card keyboard/swipe/focus, and persistent Message
behavior. It writes screenshots into tests/ for visual review.

## Voice note, memory calendar and film strip

Section keys (table `sections`): `voice_note`, `memory_calendar`, `film_strip`,
alongside `photo_wheel`. Arabic/English titles and subtitles live in
`occasion_section_contents`, seeded by `Ulfa-B/scripts/occasion-content.sql`.
Without a display_order they follow
the wheel in that order. Each is omitted when it has no usable media:

| Key | Media | Notes |
| --- | --- | --- |
| voice_note | VOICE_NOTE | Vinyl player; waveform decoded from the audio, seeded bars as fallback. Several notes show a picker (caption as label). |
| memory_calendar | IMAGE with `memory_date` | Month grid with photos on their days, plus a whole-year view. New nullable column from migration 20261007; `POST :id/media` accepts `memoryDate` (YYYY-MM-DD). |
| film_strip | IMAGE | Two counter-scrolling strips from 6 photos, and a "play the film" cinema mode (first 24 photos). |

Backgrounds alternate: wheel navy, voice note cream, calendar navy, film cream.
Headings use the Ulfa mark (SectionOrnament) instead of the old infinity ornament.
The demo voice note is public/demo/voice-note.wav.
