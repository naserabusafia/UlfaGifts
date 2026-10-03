# NFC section experience

## Changed and added files

- `NfcExperiencePage.tsx`: retain verified sections and theme/language, render the
  generic experience, and use standalone local fixtures for the offline demo.
- `demo/sections.ts` and `public/demo/photos/`: demo-only Arabic/English copy and
  30 local photo pairs (thumbnail/full), with source credits in `credits.json`.
- `components/ExperienceSections.tsx`: section registry, reveal after opening the
  letter, and one-time Message handoff.
- `components/PhotoWheel.tsx` and `components/photo-wheel.css`: virtual reel and
  accessible polaroid dialog.
- `hooks/useHorizontalDrag.ts`: mouse/touch gestures, frame scheduling, and click suppression.
- `types/experience.ts`, `utils/sections.ts`, `utils/wheel.ts`: API contracts,
  backend ordering/fallbacks, wheel math, and configurable photo click behavior.
- `src/components/EnvelopeLetter/EnvelopeLetter.tsx`: scroll completion callback,
  section-scoped letter overlay, and wheel/touch/keyboard reading gestures.
- `src/i18n/locales/en.json` and `ar.json`: localized navigation/a11y labels.
- Backend `src/modules/nfc-items/nfc-items.service.ts` and its spec: expose exact
  theme/language section text and test ordering, media scoping, and visibility.
- Frontend `package.json`, `tests/experience.test.ts`, and
  `tests/photo-wheel.browser.mjs`: dependency-free unit test command and browser
  regression harness using an existing Playwright installation.

The public verification response supplies `sections`, ordered by each item's
`item_sections.display_order`, with media and text for the item's exact theme and
language. The renderer uses a component registry and one shared ordering function.
The existing per-item Message content still comes from `item_contents`.

## Database content to fill

No tables, columns, migrations, or dependencies were added. The inspected database
has the required schema, but `sections` and `theme_section_contents` are empty.

| Existing table | Values to populate |
| --- | --- |
| `sections` | An active row with `key = 'photo_wheel'` and a name. Use `key = 'message'` for the existing letter's ordered section. |
| `nfc_items` | Set the event's `theme = 'DEFAULT'` and its exact language, e.g. `en` or `ar`. Existing items' themes are respected; the legacy backend default remains `romantic`. |
| `theme_section_contents` | For the wheel section ID, add one row per theme/language: `title` is the script heading, `message` is the serif subtitle. No fallback English copy is injected. The ornament is a decorative SVG, without text. |
| `item_sections` | Link the item and its sections with `display_order` and `is_visible = true`. Any explicit wheel order wins, including an order before Message. |
| `item_media` | Link images to this item's `item_id` and the wheel's `section_id`; use `media_type = 'IMAGE'`, `url`, `display_order`, and optional plain `caption`. |

The schema has one image URL and a plain caption, so the wheel uses that URL for
both thumbnail and full image. No image resizing service or localized-caption
table exists. The frontend also accepts optional `thumbnailUrl`/`fullUrl` if an
existing upstream service later supplies them.

When wheel photos are linked to an active section but no `item_sections` entry
exists yet, the API returns the wheel without an order. The ordering config then
places it immediately after Message. An explicitly hidden/inactive wheel stays
hidden. With zero images, the wheel is omitted.

`/nfc/demo` keeps the existing offline letter and password demo and now includes
30 bundled demo photos with Arabic/English sample copy. It needs no API or database
records. Use `/nfc/demo?auth=NONE&lang=ar` to skip the PIN screen, or keep the default
demo PIN `1234`. Open the letter and scroll down after reading to reach the wheel. `photos=1`,
`photos=5`, and `photos=30` can preview different collection sizes (0–60 allowed).
Fixtures only apply to the exact `demo` route; real NFC items still use DB data.
The sample photographs were downloaded from [Lorem Picsum](https://picsum.photos/)
and are served locally, so runtime does not depend on that service.

## Behavior and customization

Other sections stay hidden and occupy no page space until the letter opens. Their
backend order is preserved; revealing a section before Message keeps the reader's
position steady. The letter has no close button and stays unfolded after opening,
including when scrolling back to it. A downward wheel, upward touch swipe, or
scrolling key reads its remaining text first; at the end it aligns the next rendered
section with the viewport. The overlay stays inside the Message section and never
covers later sections. The handoff happens once, absorbs the remaining downward
gesture during the transition, then releases ordinary page scrolling. Direct manual
page scrolling leaves the letter open without pulling the page elsewhere. Reduced
motion uses an instant jump. The wheel canvas adapts to the available height so the heading,
complete reel, and controls fit together on mobile and desktop.

Change `PHOTO_CLICK_BEHAVIOR` in `utils/wheel.ts` from `activate-first` to `open-any`
to make every photo click open the card. Wheel geometry and visibility constants
are beside it. Interface/a11y labels use the existing i18n files; section heading
and subtitle come from the DB for real items and isolated fixtures for the demo.

The whole reel is visible. A nonlinear angle mapping keeps photos widely spaced
near the top and compresses them into the bottom with gaps, where they shrink to
6% size for 30 photos. Larger collections shrink further. The active photo uses
140% scale and rises 16px above its circular position.
Every photo has a unique virtual slot; images are briefly hidden only while
crossing the wrap seam so the transform never spins backwards across the reel.

The dialog locks/restores body and document scroll, traps focus, preloads the
active image and neighbors, and restores focus to its photo opener. If navigation
has put that opener into the compressed bottom stack, it brings it back to the top.

## Validation

- `npm run build`
- `npm test` (built-in Node test runner, Node 22.18+)
- Run `tests/photo-wheel.browser.mjs` with an existing Playwright installation:
  set `PLAYWRIGHT_MODULE` to its module path and optionally `TEST_ORIGIN` to the
  running Vite server. The harness uses headless Edge and intercepted fixture
  responses; it does not write to the database. It checks mobile/desktop, 1/5/30
  photos, the complete unclipped reel, compressed bottom, ordering, Message handoff,
  reveal after opening, persistent open letters and reading position, readable long
  letters, wheel/touch/keyboard handoff, manual scroll, reduced motion,
  card navigation, focus, mouse drag, touch swipe,
  RTL, empty data, and the actual offline demo with all API requests blocked.
  It saves fixture and offline-demo screenshots in `tests/` for visual review.
