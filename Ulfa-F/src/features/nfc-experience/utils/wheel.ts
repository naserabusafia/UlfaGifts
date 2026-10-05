export const SLOT_ANGLE = 45;
export const VISIBLE_OFFSET = 3;
export const VISIBLE_COUNT = VISIBLE_OFFSET * 2 + 1;
export const MAX_DIAMETER = 560;
export const DIAMETER_RATIO = .94;
export const PHOTO_SIZE_RATIO = .22;
export const ACTIVE_SCALE = 1.45;
export const NEIGHBOR_SCALE_FALLOFF = 0;
export const PHOTO_RADIUS_INSET = .72;
export const ACTIVE_RADIUS_INSET = .15;
export const NUMBER_RADIUS_RATIO = .16;
export const HOLE_RATIO = .14;
export const PILE_SIZE_RATIO = .8;
export const PILE_RADIUS_RATIO = .35;
export const PILE_MAX_COUNT = 14;
export const PILE_MIN_COUNT = 3;
export const PILE_FRACTION = .5;
export const PILE_MIN_SCALE = .85;
export const PILE_ROTATION = 25;
export const PILE_JITTER_X = .12;
export const PILE_JITTER_Y = .05;
export const TRANSITION_MS = 450;
export const TRANSITION_EASING = 'cubic-bezier(.22,.8,.25,1)';
export const CLICK_MODE: 'rotate-then-open' | 'open-any' = 'rotate-then-open';
export const HINT_DELAY_MS = 400;
export const HINT_PAUSE_MS = 300;
export const DRAG_ANGLE_THRESHOLD = 4;
export const DRAG_PIXEL_THRESHOLD = 6;
export const MOMENTUM_THRESHOLD = .28;
export const MAX_MOMENTUM_SLOTS = 3;

export function wrapIndex(index: number, count: number) {
  return count ? ((index % count) + count) % count : 0;
}

export function signedOffset(index: number, active: number, count: number) {
  let offset = wrapIndex(index - active, count);
  if (offset > count / 2) offset -= count;
  return offset;
}

export function wheelWindow(active: number, count: number) {
  if (!count) return [];
  const indices = new Set<number>();
  for (let offset = -VISIBLE_OFFSET; offset <= VISIBLE_OFFSET; offset++) {
    const index = wrapIndex(active + offset, count);
    if (Math.abs(signedOffset(index, active, count)) <= VISIBLE_OFFSET) indices.add(index);
  }
  return [...indices].map((index) => ({ index, offset: signedOffset(index, active, count) }));
}

export function pileWindow(active: number, count: number) {
  const remaining = Math.max(0, count - VISIBLE_COUNT);
  if (!remaining) return [];
  const length = Math.min(PILE_MAX_COUNT, Math.max(PILE_MIN_COUNT, Math.ceil(remaining * PILE_FRACTION)));
  return Array.from({ length }, (_, depth) => ({ index: wrapIndex(active + VISIBLE_OFFSET + 1 + depth, count), depth }));
}

export function wheelSlot(offset: number, dragAngle = 0) {
  const angle = offset * SLOT_ANGLE + dragAngle;
  const distance = Math.abs(angle / SLOT_ANGLE);
  const emphasis = Math.max(0, 1 - distance);
  const neighborScale = Math.max(.7, 1 - NEIGHBOR_SCALE_FALLOFF * Math.max(0, distance - 1));
  const scale = neighborScale + (ACTIVE_SCALE - neighborScale) * emphasis;
  const radius = .5 - PHOTO_SIZE_RATIO * (PHOTO_RADIUS_INSET + (ACTIVE_RADIUS_INSET - PHOTO_RADIUS_INSET) * emphasis);
  const radians = angle * Math.PI / 180;
  return { angle, scale, radius, x: Math.sin(radians) * radius, y: -Math.cos(radians) * radius, emphasis };
}

export function seededPose(id: string) {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  const next = () => {
    hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
    return (hash >>> 0) / 4294967295 * 2 - 1;
  };
  return { angle: next() * PILE_ROTATION, x: next() * PILE_JITTER_X, y: next() * PILE_JITTER_Y };
}

export function angularDelta(current: number, previous: number) {
  return ((current - previous + 540) % 360) - 180;
}

export function releaseSlots(rotation: number, velocity: number) {
  const momentum = Math.abs(velocity) >= MOMENTUM_THRESHOLD
    ? Math.sign(velocity) * Math.min(MAX_MOMENTUM_SLOTS, Math.floor(Math.abs(velocity) / MOMENTUM_THRESHOLD)) : 0;
  return -Math.round(rotation / SLOT_ANGLE) - momentum;
}
