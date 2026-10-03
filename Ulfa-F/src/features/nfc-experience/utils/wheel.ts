export const WHEEL_STEP = 42;
export const MIN_SCALE = 0.06;
export const ACTIVE_SCALE = 1.4;
export const PHOTO_CLICK_BEHAVIOR: 'activate-first' | 'open-any' = 'activate-first';

export function wrapIndex(index: number, count: number) {
  return count ? ((index % count) + count) % count : 0;
}

export function wheelSlot(index: number, active: number, count: number, dragSteps = 0) {
  if (!count) return { offset: 0, angle: 0, scale: 1, lift: 0, visible: false };
  let offset = wrapIndex(index - active + dragSteps, count);
  if (offset > count / 2) offset -= count;
  // Wide gaps around the active slot; the remaining slots share the bottom arc.
  // Keep a non-zero bottom gap instead of piling every tail image at 180deg.
  const half = count / 2;
  const distance = Math.abs(offset);
  const topSlots = 3;
  const topAngle = topSlots * WHEEL_STEP;
  const degrees = half <= topSlots
    ? distance * 180 / half
    : distance <= topSlots
      ? distance * WHEEL_STEP
      : topAngle + (distance - topSlots) * (180 - topAngle) / (half - topSlots);
  const angle = Math.sign(offset) * degrees;
  const t = (Math.cos(angle * Math.PI / 180) + 1) / 2;
  const minimum = MIN_SCALE * Math.min(1, 30 / count);
  const scale = minimum + (.74 - minimum) * t ** 2.8 + (ACTIVE_SCALE - .74) * t ** 32;
  return { offset, angle, scale, lift: 16 * t ** 12, visible: true };
}
