import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedSections } from '../src/features/nfc-experience/utils/sections.ts';
import { ACTIVE_SCALE, MIN_SCALE, WHEEL_STEP, wheelSlot, wrapIndex } from '../src/features/nfc-experience/utils/wheel.ts';
import { demoSections } from '../src/features/nfc-experience/demo/sections.ts';

const photo = { id: 'photo', mediaType: 'IMAGE', url: '/photo.jpg', displayOrder: 1 };

test('backend order wins, including placing the wheel before Message', () => {
  const result = orderedSections([
    { id: 'message', key: 'message', displayOrder: 20 },
    { id: 'wheel', key: 'photo_wheel', displayOrder: 0, media: [photo] },
  ]);
  assert.deepEqual(result.map((s) => s.key), ['photo_wheel', 'message']);
});

test('only a wheel missing an order uses the after-Message fallback', () => {
  const result = orderedSections([
    { id: 'next', key: 'timeline', displayOrder: 12 },
    { id: 'wheel', key: 'photo_wheel', media: [photo] },
    { id: 'message', key: 'message', displayOrder: 10 },
  ]);
  assert.deepEqual(result.map((s) => s.key), ['message', 'photo_wheel', 'timeline']);
  assert.deepEqual(orderedSections([{ id: 'wheel', key: 'photo_wheel', media: [photo] }]).map((s) => s.key), ['message', 'photo_wheel']);
});

test('an empty wheel is omitted and legacy letter remains available', () => {
  assert.deepEqual(orderedSections([{ id: 'wheel', key: 'photo_wheel', media: [] }]).map((s) => s.key), ['message']);
});

for (const count of [1, 5, 30]) {
  test(`${count} photos: unique slots, largest active photo, full circle, cyclic navigation`, () => {
    for (let active = 0; active < count; active++) {
      const slots = Array.from({ length: count }, (_, i) => wheelSlot(i, active, count));
      assert.equal(new Set(slots.map((s) => s.offset)).size, count);
      assert.equal(slots[active].angle, 0);
      assert.equal(slots[active].scale, ACTIVE_SCALE);
      assert.equal(slots[active].lift, 16);
      assert.equal(slots[active].visible, true);
      assert.ok(slots.every((s) => s.scale <= ACTIVE_SCALE && s.scale >= MIN_SCALE));
      assert.equal(slots.filter((s) => s.visible).length, count);
      if (count > 1) assert.ok(slots.some((s) => Math.abs(s.angle) > 110));
    }
    assert.equal(wrapIndex(count, count), 0);
    assert.equal(wrapIndex(-1, count), count - 1);
  });
}

test('30-photo reel packs angles and shrinks photos toward the visible bottom', () => {
  const topGap = wheelSlot(1, 0, 30).angle - wheelSlot(0, 0, 30).angle;
  const bottomGap = wheelSlot(15, 0, 30).angle - wheelSlot(14, 0, 30).angle;
  assert.equal(topGap, WHEEL_STEP);
  assert.ok(bottomGap < topGap / 5);
  assert.equal(wheelSlot(15, 0, 30).scale, MIN_SCALE);
  assert.equal(wheelSlot(15, 0, 30).angle, 180);
});

test('upper neighbors shrink quickly and bottom slots retain gaps instead of sharing one position', () => {
  const active = wheelSlot(0, 0, 30);
  const neighbor = wheelSlot(1, 0, 30);
  assert.ok(active.scale > neighbor.scale * 2);
  assert.ok(active.lift > neighbor.lift);
  assert.ok(wheelSlot(14, 0, 30).angle < 176);
  assert.ok(wheelSlot(14, 0, 30).scale < .061);
});

test('offline demo has localized copy and local photo variants without a backend order', () => {
  for (const language of ['en', 'ar'] as const) for (const count of [1, 5, 30]) {
    const [wheel] = demoSections(language, count);
    assert.equal(wheel.media?.length, count);
    assert.equal(wheel.displayOrder, undefined);
    assert.ok(wheel.title && wheel.message);
    assert.ok(wheel.media?.every((m) => m.url.startsWith('/demo/photos/') && m.thumbnailUrl?.endsWith('-thumb.jpg')));
    assert.deepEqual(orderedSections([wheel]).map((s) => s.key), ['message', 'photo_wheel']);
  }
});
