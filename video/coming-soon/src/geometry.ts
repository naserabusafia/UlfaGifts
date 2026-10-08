// Shapes for the gold thread: a handwritten flourish that relaxes into a hanging necklace.
// Both are resampled to the same number of points by arc length, so they can be morphed point by point.

export type Pt = readonly [number, number];

const SAMPLES = 900;
export const POINTS = 320;

const resample = (raw: Pt[], n: number): Pt[] => {
  const acc = [0];
  for (let i = 1; i < raw.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
  }
  const total = acc[acc.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    while (j < acc.length - 1 && acc[j] < d) j++;
    const f = (d - acc[j - 1]) / (acc[j] - acc[j - 1] || 1);
    out.push([raw[j - 1][0] + (raw[j][0] - raw[j - 1][0]) * f, raw[j - 1][1] + (raw[j][1] - raw[j - 1][1]) * f]);
  }
  return out;
};

// Cursive loops written left to right across the middle of the frame, slightly slanted like handwriting.
const handwriting = (): Pt[] => {
  const raw: Pt[] = [];
  const loops = 4.5;
  for (let i = 0; i <= SAMPLES; i++) {
    const s = i / SAMPLES;
    const env = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, s * 1.15));
    const r = 92 * env;
    const a = 2 * Math.PI * loops * s - Math.PI / 2;
    const y0 = 930 + 70 * Math.sin(Math.PI * s * 1.4 + 0.3);
    const y = y0 - r * 1.35 * Math.cos(a);
    const x = -90 + 1260 * s + r * Math.sin(a) + 0.22 * (y0 - y);
    raw.push([x, y]);
  }
  return resample(raw, POINTS);
};

export const NECK = { cx: 540, bottom: 860, top: -70, half: 430 };

// A necklace hanging from beyond the top of the frame, its lowest point at the centre.
const necklace = (): Pt[] => {
  const raw: Pt[] = [];
  const k = 2.1;
  for (let i = 0; i <= SAMPLES; i++) {
    const u = (i / SAMPLES) * 2 - 1;
    const x = NECK.cx + NECK.half * u;
    const y = NECK.bottom - (NECK.bottom - NECK.top) * ((Math.cosh(k * u) - 1) / (Math.cosh(k) - 1));
    raw.push([x, y]);
  }
  return resample(raw, POINTS);
};

export const THREAD = handwriting();
export const CHAIN = necklace();

// Morph between the two shapes; `pull` drags the lowest part of the chain down under the pendant's weight.
export const shapeAt = (morph: number, pull: number): Pt[] =>
  THREAD.map((p, i) => {
    const c = CHAIN[i];
    const u = (i / (POINTS - 1)) * 2 - 1;
    const sag = pull * Math.pow(Math.max(0, 1 - Math.abs(u)), 2.4);
    return [p[0] + (c[0] - p[0]) * morph, p[1] + (c[1] + sag - p[1]) * morph] as const;
  });

export const toPath = (pts: Pt[]): string => {
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
};

// The pen tip: the point at fraction p of the drawn length.
export const pointAt = (pts: Pt[], p: number): Pt => {
  const f = Math.min(pts.length - 1, Math.max(0, p * (pts.length - 1)));
  const i = Math.floor(f);
  const j = Math.min(pts.length - 1, i + 1);
  const t = f - i;
  return [pts[i][0] + (pts[j][0] - pts[i][0]) * t, pts[i][1] + (pts[j][1] - pts[i][1]) * t];
};

// The Ulfa monogram: two interlaced loops (a lemniscate), as on the brand seal.
export const monogram = (scale: number): string => {
  const pts: Pt[] = [];
  for (let i = 0; i <= 160; i++) {
    const u = (i / 160) * Math.PI * 2 + Math.PI / 2;
    const den = 1 + Math.sin(u) ** 2;
    pts.push([(scale * 1.45 * Math.cos(u)) / den, (scale * Math.sin(u) * Math.cos(u) * 1.6) / den]);
  }
  return toPath(pts) + ' Z';
};
