'use strict';
/* Ulfa — motion piece synced to the Arabic voiceover (vo.wav).
   Deterministic: renderFrame(t) draws the exact frame for time t (seconds). */

const W = 1080, H = 1920, FPS = 60, DUR = 17.0;
const cv = document.getElementById('c');
const out = cv.getContext('2d');
const work = document.createElement('canvas'); work.width = W; work.height = H;
const wctx = work.getContext('2d');

// Beats measured from the voiceover energy envelope (seconds).
const B = {
  start: 0.22, shutter: 1.12, lahazat: 1.36, ashan: 1.98, nensaha: 2.16, endA: 2.95,
  baadein: 3.60, benensaha: 4.82, alf: 5.40, suwar: 5.78, endB: 6.17,
  bas: 6.88, lahazat2: 7.10, mesh: 8.26, mojarrad: 8.80, soora: 9.38, mobile: 9.56, endC: 10.0,
  lazem: 10.80, aqrab: 11.22, ashan2: 12.20, amilna: 13.58, ulfa: 14.00,
};

const COL = {
  navy: '#282749', navyD: '#141329', ink: '#262648', cream: '#f3eee3', paper: '#f6f1e6',
  disk: '#ebe5da', blush: '#ecdbd6', wine: '#7a1f2e', rose: '#d5adaf', gold: '#f2c98a',
};

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const TAU = Math.PI * 2;
const E = {
  in2: t => t * t,
  out2: t => 1 - (1 - t) * (1 - t),
  in3: t => t * t * t,
  out3: t => 1 - Math.pow(1 - t, 3),
  inOut3: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out5: t => 1 - Math.pow(1 - t, 5),
  inOut5: t => t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
};
// damped spring step 0 → 1 (with overshoot)
const spring = (x, k = 9, w = 20) => x <= 0 ? 0 : 1 - Math.exp(-k * x) * Math.cos(w * x);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lerpM = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return `rgb(${lerp(a[0], b[0], t) | 0},${lerp(a[1], b[1], t) | 0},${lerp(a[2], b[2], t) | 0})`; };
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

/* ---------- assets ---------- */
const IDS = [10, 11, 12, 15, 16, 18, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 37, 42, 43, 49, 50, 54, 57, 58, 64, 65, 66, 76, 82, 83];
const FX = { 65: .28, 64: .45, 21: .4, 27: .05, 42: .6, 82: .5, 49: .5, 76: .5 };
const HERO = 65;
const WHEEL = [65, 21, 64, 49, 76, 82, 27, 42];     // slot 0 is the hero
const TWINKLE = [21, 64, 49, 82, 27, 76];
const PH = {};
const NONHERO = IDS.filter(x => x !== HERO);
let SEAL, ENVTEX, GRAIN = [], PAPER, ENVPAT;

function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); fn(x, c); return c; }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function crop(id, aspect, zoom = 1, fx, fy = .5) {
  const im = PH[id].img, iw = im.width, ih = im.height;
  fx = fx ?? (FX[id] ?? .5);
  let sw, sh;
  if (aspect < iw / ih) { sh = ih / zoom; sw = sh * aspect; } else { sw = iw / zoom; sh = sw / aspect; }
  return [(iw - sw) * fx, (ih - sh) * fy, sw, sh];
}
function drawCrop(c, id, cr, x, y, w, h) { c.drawImage(PH[id].img, cr[0], cr[1], cr[2], cr[3], x, y, w, h); }

async function load() {
  await Promise.all(IDS.map(async id => { PH[id] = { img: await loadImg(`assets/photos/${id}-full.jpg`) }; }));
  for (const id of IDS) {
    const p = PH[id];
    p.sq = mk(512, 512, c => { const cr = crop(id, 1); c.drawImage(p.img, cr[0], cr[1], cr[2], cr[3], 0, 0, 512, 512); });
    p.sm = mk(128, 128, c => c.drawImage(p.sq, 0, 0, 128, 128));
    p.md = mk(256, 256, c => c.drawImage(p.sq, 0, 0, 256, 256));
  }
  SEAL = await loadImg('assets/seal.png');
  ENVTEX = await loadImg('assets/envelope-texture.jpg');
  const r = rng(7);
  for (let g = 0; g < 6; g++) GRAIN.push(mk(540, 960, c => {
    const d = c.createImageData(540, 960);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    c.putImageData(d, 0, 0);
  }));
  PAPER = mk(512, 512, c => {
    c.fillStyle = COL.paper; c.fillRect(0, 0, 512, 512);
    const d = c.getImageData(0, 0, 512, 512);
    for (let i = 0; i < d.data.length; i += 4) { const n = (r() - .5) * 14; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n - 1; }
    c.putImageData(d, 0, 0);
  });
  ENVPAT = mk(720, 464, c => c.drawImage(ENVTEX, 0, 0));
  await document.fonts.load('700 200px Amiri', 'ألفة');
  await document.fonts.load('600 60px "Cormorant Garamond"', 'ULFA');
  await document.fonts.ready;
  buildGallery();
}

/* ---------- shared drawing ---------- */
function shadowed(c, color, blur, ox, oy, fn) { c.save(); c.shadowColor = color; c.shadowBlur = blur; c.shadowOffsetX = ox; c.shadowOffsetY = oy; fn(); c.restore(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
function glow(c, x, y, r, color, a) {
  if (a <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}
function vignette(c, a, color = '0,0,0') {
  const g = c.createRadialGradient(W / 2, H * .48, H * .28, W / 2, H * .48, H * .78);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${a})`);
  c.fillStyle = g; c.fillRect(-150, -150, W + 300, H + 300);
}
const MOTES = (() => { const r = rng(42); return Array.from({ length: 46 }, () => ({ x: r() * W, y: r() * H, z: .3 + r() * .9, ph: r() * TAU, sp: .2 + r() * .6, s: r() })); })();
function motes(c, t, a, color = '255,214,170') {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const m of MOTES) {
    const x = (m.x + Math.sin(t * m.sp + m.ph) * 40 * m.z + t * 12 * m.z) % (W + 80) - 40;
    const y = (m.y - t * 34 * m.z * m.sp + H * 4) % (H + 80) - 40;
    const rad = (m.s < .15 ? 26 : 5) * m.z;
    const tw = .55 + .45 * Math.sin(t * 2.3 + m.ph * 3);
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${color},${(m.s < .15 ? .10 : .55) * tw * a})`); g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  c.restore();
}
function warmBG(c, t, a = 1) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  const g = c.createRadialGradient(W / 2, H * .45, 60, W / 2, H * .5, H * .85);
  g.addColorStop(0, '#3b3868'); g.addColorStop(.45, '#26244a'); g.addColorStop(1, '#0f0e22');
  c.fillStyle = g; c.fillRect(-150, -150, W + 300, H + 300);
  // drifting light leaks
  glow(c, W * (.85 + .08 * Math.sin(t * .4)), H * (.12 + .04 * Math.cos(t * .5)), 700, 'rgba(255,170,120,.55)', .22);
  glow(c, W * (.1 + .06 * Math.cos(t * .37)), H * (.86 + .03 * Math.sin(t * .6)), 650, 'rgba(213,173,175,.6)', .14);
  c.restore();
}

/* ---------- camera shake ---------- */
const SHAKES = [[1.13, 7, 9, 46], [6.88, 6, 10, 38], [11.62, 3, 14, 50], [12.02, 3, 14, 50], [14.0, 30, 8.5, 44]];
function shake(t) {
  let x = 0, y = 0;
  for (const [t0, a, k, f] of SHAKES) {
    if (t < t0) continue; const d = t - t0, e = a * Math.exp(-k * d);
    x += e * Math.sin(d * f + 1.3); y += e * Math.cos(d * f * 1.13);
  }
  return [x, y];
}

/* =========================================================
   ACT 1 — camera viewfinder, shutter, the floating memory
   ========================================================= */
const PR = { x: 0, y: 210, w: 1080, h: 1440 };            // preview rect
const CARD = { cx: 540, cy: 940, w: 780, h: 1040 };        // floating memory card

function camZoom(t) { return 1.14 - .06 * E.inOut3(P(t, 0, 1.1)); }
function camFocusBlur(t) {
  if (t < .82) return lerp(18, 4, E.out3(P(t, .1, .82))) + 3 * Math.sin(t * 11) * (1 - P(t, .3, .82));
  return lerp(4, 0, E.out3(P(t, .82, .95)));
}
function heroCardPose(t) {
  // returns {cx,cy,w,h,rot,rad,crop,shadow}
  const fx = FX[HERO] + .02 * Math.sin(t * 1.7);
  const viewCrop = crop(HERO, 3 / 4, camZoom(Math.min(t, 1.25)), fx, .5 + .03 * Math.sin(t * 1.3 + 1));
  if (t < 1.28) return { cx: PR.x + PR.w / 2, cy: PR.y + PR.h / 2, w: PR.w, h: PR.h, rot: 0, rad: 0, crop: viewCrop, sh: 0 };
  const e = E.inOut3(P(t, 1.28, 2.05));
  const fl = P(t, 1.7, 2.6);
  const bob = Math.sin(t * 1.4) * 10 * fl, sway = (Math.sin(t * .9 + .5) * .012) * fl;
  const push = 1 + .045 * E.inOutSine(P(t, 2.0, 3.25));
  const cardCrop = lerpM(viewCrop, crop(HERO, 3 / 4, 1), e);
  let pose = {
    cx: lerp(540, CARD.cx, e), cy: lerp(PR.y + PR.h / 2, CARD.cy, e) + bob,
    w: lerp(PR.w, CARD.w, e) * push, h: lerp(PR.h, CARD.h, e) * push,
    rot: lerp(0, -.04, e) + sway, rad: lerp(0, 46, e), crop: cardCrop, sh: e,
  };
  // morph into the gallery tile (3:4 card → 1:1 tile)
  const m = E.inOut5(P(t, 3.22, 3.62));
  if (m > 0) {
    const ts = 360 * (1 - .017);
    pose = { cx: lerp(pose.cx, 540, m), cy: lerp(pose.cy, 960, m), w: lerp(pose.w, ts, m), h: lerp(pose.h, ts, m),
      rot: lerp(pose.rot, 0, m), rad: lerp(pose.rad, 0, m), crop: lerpM(cardCrop, crop(HERO, 1), m), sh: pose.sh * (1 - m) };
  }
  return pose;
}

function act1Background(c, t) {
  c.fillStyle = '#000'; c.fillRect(-150, -150, W + 300, H + 300);
  const n = E.inOut3(P(t, 1.25, 2.1)) * (1 - P(t, 3.25, 3.6));
  warmBG(c, t, n);
  glow(c, CARD.cx, CARD.cy, 980, 'rgba(255,176,110,.7)', .32 * n * (.85 + .15 * Math.sin(t * 2)));
  motes(c, t, P(t, 1.5, 2.3) * (1 - P(t, 3.1, 3.5)));
}

function act1Foreground(c, t) {
  const pose = heroCardPose(t);
  const uiA = 1 - E.out3(P(t, 1.24, 1.5));
  // memory card / viewfinder image
  c.save();
  c.translate(pose.cx, pose.cy); c.rotate(pose.rot);
  if (pose.sh > 0) shadowed(c, `rgba(5,4,20,${.6 * pose.sh})`, 90 * pose.sh, 0, 40 * pose.sh, () => { rr(c, -pose.w / 2, -pose.h / 2, pose.w, pose.h, pose.rad); c.fillStyle = '#000'; c.fill(); });
  rr(c, -pose.w / 2, -pose.h / 2, pose.w, pose.h, pose.rad); c.clip();
  const b = t < 1.28 ? camFocusBlur(t) : 0;
  if (b > .3) c.filter = `blur(${b.toFixed(2)}px) saturate(${lerp(1, .85, P(b, 0, 18))})`;
  drawCrop(c, HERO, pose.crop, -pose.w / 2 - b * 2, -pose.h / 2 - b * 2, pose.w + b * 4, pose.h + b * 4);
  c.filter = 'none';
  // glossy sweep across the memory
  const gs = P(t, 2.15, 3.05);
  if (gs > 0 && gs < 1) {
    const x = lerp(-pose.w * 1.2, pose.w * 1.2, E.inOut3(gs));
    const g = c.createLinearGradient(x - 160, -pose.h / 2, x + 160, pose.h / 2);
    g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(.5, 'rgba(255,240,220,.22)'); g.addColorStop(1, 'rgba(255,240,220,0)');
    c.fillStyle = g; c.fillRect(-pose.w / 2, -pose.h / 2, pose.w, pose.h);
  }
  c.restore();
  if (pose.sh > 0) { c.save(); c.translate(pose.cx, pose.cy); c.rotate(pose.rot); rr(c, -pose.w / 2 + 1, -pose.h / 2 + 1, pose.w - 2, pose.h - 2, pose.rad); c.strokeStyle = `rgba(255,255,255,${.25 * pose.sh * (1 - P(t, 3.2, 3.5))})`; c.lineWidth = 2; c.stroke(); c.restore(); }

  if (uiA > 0) cameraUI(c, t, uiA);
  // shutter iris + flash
  iris(c, t);
  const fl = P(t, 1.19, 1.62);
  if (fl > 0 && fl < 1) { c.fillStyle = `rgba(255,250,240,${.92 * (1 - E.out3(fl))})`; c.fillRect(0, 0, W, H); }
  // fade-in from black
  const fi = 1 - E.out3(P(t, 0, .45));
  if (fi > 0) { c.fillStyle = `rgba(0,0,0,${fi})`; c.fillRect(0, 0, W, H); }
}

function cameraUI(c, t, a) {
  c.save(); c.globalAlpha = a;
  const drop = 60 * (1 - a);
  // top & bottom dark bars
  c.fillStyle = '#000'; c.fillRect(0, 0, W, PR.y); c.fillRect(0, PR.y + PR.h, W, H - PR.y - PR.h);
  // rule-of-thirds
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2; c.beginPath();
  for (let i = 1; i < 3; i++) { c.moveTo(PR.w * i / 3, PR.y); c.lineTo(PR.w * i / 3, PR.y + PR.h); c.moveTo(0, PR.y + PR.h * i / 3); c.lineTo(W, PR.y + PR.h * i / 3); }
  c.stroke();
  // focus brackets
  const lock = P(t, .82, .9);
  const sz = lerp(300, 210, E.out3(P(t, .1, .82))) * (1 + .12 * (1 - spring(t - .82, 10, 28)) * (t > .82 ? 1 : 0)) * (t > .82 ? 1 : 1);
  const fxp = 470 + 8 * Math.sin(t * 2), fyp = 800 + 6 * Math.cos(t * 2.4);
  const fcol = lock > 0 ? `rgba(255,${lerp(255, 204, lock) | 0},${lerp(255, 77, lock) | 0},${.95})` : `rgba(255,255,255,${.6 + .35 * Math.sin(t * 14)})`;
  const fa = t < 1.0 ? 1 : 1 - P(t, 1.0, 1.15);
  c.globalAlpha = a * fa; c.strokeStyle = fcol; c.lineWidth = 4; c.lineCap = 'round';
  const L = 38, h = sz / 2; c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { c.moveTo(fxp + sx * h, fyp + sy * h - sy * L); c.lineTo(fxp + sx * h, fyp + sy * h); c.lineTo(fxp + sx * h - sx * L, fyp + sy * h); }
  c.stroke();
  if (lock > 0) { c.globalAlpha = a * fa * lock; c.beginPath(); c.moveTo(fxp + h + 30, fyp - 40); c.lineTo(fxp + h + 30, fyp + 40); c.stroke(); c.beginPath(); c.arc(fxp + h + 30, fyp - 10, 12, 0, TAU); c.stroke(); }
  c.globalAlpha = a;
  // top icons
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 4;
  c.beginPath(); c.moveTo(96, 80); c.lineTo(78, 112); c.lineTo(96, 112); c.lineTo(86, 142); c.lineTo(112, 104); c.lineTo(94, 104); c.lineTo(104, 80); c.closePath(); c.stroke();
  c.beginPath(); c.moveTo(510, 104); c.lineTo(540, 86); c.lineTo(570, 104); c.stroke();
  c.beginPath(); c.arc(984, 110, 24, 0, TAU); c.stroke(); c.beginPath(); c.arc(984, 110, 9, 0, TAU); c.fill();
  // bottom controls
  const by = 1785 + drop;
  const press = t > 1.04 && t < 1.32 ? Math.sin(P(t, 1.04, 1.32) * Math.PI) : 0;
  c.lineWidth = 8; c.beginPath(); c.arc(540, by, 86, 0, TAU); c.stroke();
  c.beginPath(); c.arc(540, by, 70 - 12 * press, 0, TAU); c.fill();
  // gallery thumbnail updates after the shot
  const swap = P(t, 1.3, 1.36);
  const pop = 1 + .25 * Math.sin(P(t, 1.3, 1.5) * Math.PI);
  c.save(); c.translate(200, by); c.scale(pop, pop); rr(c, -48, -48, 96, 96, 18); c.clip();
  c.drawImage(PH[swap > .5 ? HERO : 49].md, -48, -48, 96, 96); c.restore();
  rr(c, 152, by - 48, 96, 96, 18); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
  c.lineWidth = 5; c.strokeStyle = '#fff';
  c.beginPath(); c.arc(880, by, 40, -2.6, .4); c.stroke(); c.beginPath(); c.arc(880, by, 40, .55, 3.55); c.stroke();
  c.beginPath(); c.moveTo(916, by + 24); c.lineTo(918, by + 6); c.lineTo(900, by + 12); c.fill();
  // mode dot
  c.fillStyle = '#ffcc4d'; c.beginPath(); c.arc(540, by - 128, 6, 0, TAU); c.fill();
  c.restore();
}

function iris(c, t) {
  if (t < 1.1 || t > 1.36) return;
  const R = 1150;
  let r;
  if (t < 1.18) r = R * (1 - E.in3(P(t, 1.1, 1.18)));
  else if (t < 1.21) r = 0;
  else r = R * E.out3(P(t, 1.21, 1.36));
  const rot = (1 - r / R) * 1.1;
  const cx = 540, cy = PR.y + PR.h / 2;
  c.save(); c.beginPath(); c.rect(PR.x, PR.y, PR.w, PR.h); c.clip();
  c.beginPath(); c.rect(0, 0, W, H);
  const pts = [];
  for (let i = 0; i < 6; i++) { const a = rot + i * TAU / 6; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  c.moveTo(pts[0][0], pts[0][1]); for (let i = 5; i >= 0; i--) c.lineTo(pts[i][0], pts[i][1]); c.closePath();
  c.fillStyle = '#07060d'; c.fill('evenodd');
  // blade edges
  c.strokeStyle = 'rgba(120,120,150,.35)'; c.lineWidth = 3; c.beginPath();
  for (let i = 0; i < 6; i++) { const [x, y] = pts[i]; const a = rot + i * TAU / 6 + Math.PI / 2 + .35; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 1600, y + Math.sin(a) * 1600); }
  c.stroke();
  c.restore();
}

/* =========================================================
   ACT 2 — the gallery: scroll, zoom out, a thousand photos
   ========================================================= */
const GAL = { t0: 3.3, dt: 1 / 1200, cy: [], special: null, twinkles: [] };
function galVel(t) {
  if (t < 3.62) return 0;
  if (t < 4.82) return .32 * E.inOut3(P(t, 3.62, 4.3));
  if (t < 5.45) return .32 + 21 * E.in3(P(t, 4.82, 5.45));
  if (t < 6.4) return lerp(21.32, 1.1, E.out3(P(t, 5.45, 6.4)));
  if (t < 6.88) return 1.1;
  return 1.1 * (1 - E.out3(P(t, 6.88, 7.0)));
}
function galScale(t) {
  if (t < 5.45) return 360;
  if (t < 6.4) return 360 * Math.pow(30 / 360, E.inOut3(P(t, 5.45, 6.4)));
  return 30 * (1 + .06 * E.inOut3(P(t, 6.95, 7.5)));
}
function buildGallery() {
  let y = 0;
  for (let t = GAL.t0; t <= 8.6; t += GAL.dt) { GAL.cy.push(y); y += galVel(t) * GAL.dt; }
  const cyB = galCy(7.1), s = 30;
  const i0 = Math.round((560 - 540) / s), j0 = Math.round(cyB + (820 - 960) / s);
  GAL.special = [i0, j0];
  const offs = [[-8, -13], [9, -7], [-10, 5], [7, 11], [-4, 17], [11, -19]];
  GAL.twinkles = offs.map(([di, dj], n) => ({ i: i0 + di, j: j0 + dj, id: TWINKLE[n], t: B.lahazat2 + n * .065 }));
  GAL.map = new Map();
  GAL.map.set(`${i0},${j0}`, HERO);
  GAL.twinkles.forEach(k => GAL.map.set(`${k.i},${k.j}`, k.id));
}
function galCy(t) { const k = (t - GAL.t0) / GAL.dt; const i = clamp(Math.floor(k), 0, GAL.cy.length - 2); const f = clamp(k - i); return lerp(GAL.cy[i], GAL.cy[i + 1], f); }
function tileId(i, j) {
  if (i === 0 && j === 0) return HERO;
  const m = GAL.map.get(`${i},${j}`); if (m) return m;
  const k = (((i * 7 + j * 12) % 29) + 29) % 29;
  return NONHERO[k];
}
function galCam(t) {
  // returns {cx, cy, s}
  const [si, sj] = GAL.special;
  let s = galScale(t), cx = 0, cy = galCy(t);
  if (t > 7.45) {
    const s0 = galScale(7.45), cy0 = galCy(7.45);
    const px0 = 540 + (si - 0) * s0, py0 = 960 + (sj - cy0) * s0;
    const e = E.inOut3(P(t, 7.45, 8.15));
    const sEnd = 616 / (1 - .017);
    s = s0 * Math.pow(sEnd / s0, e);
    const px = lerp(px0, 540, E.inOut3(P(t, 7.45, 8.0))), py = lerp(py0, 960, E.inOut3(P(t, 7.45, 8.0)));
    cx = si - (px - 540) / s; cy = sj - (py - 960) / s;
  }
  return { cx, cy, s };
}
function act2(c, t) {
  const bgA = E.inOut3(P(t, 3.22, 3.5));
  c.save(); c.globalAlpha = bgA; c.fillStyle = '#06060a'; c.fillRect(-150, -150, W + 300, H + 300); c.restore();
  const { cx, cy, s } = galCam(t);
  const ts = s * (1 - .017);
  const big = ts > 150, mid = ts > 70;
  const i1 = Math.floor(cx - 540 / s) - 1, i2 = Math.ceil(cx + 540 / s) + 1;
  const j1 = Math.floor(cy - 960 / s) - 1, j2 = Math.ceil(cy + 960 / s) + 1;
  const [si, sj] = GAL.special;
  const wallFade = 1 - P(t, 7.85, 8.15);
  if (wallFade > 0) {
    c.save(); c.globalAlpha = wallFade;
    for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) {
      if (t < 3.62 && i === 0 && j === 0) continue;
      if (t > 6.85 && i === si && j === sj) continue;
      const x = 540 + (i - cx) * s, y = 960 + (j - cy) * s;
      let sc = 1, a = 1;
      if (t < 4.2) { const d = Math.hypot(i, j); const p = P(t, 3.36 + d * .05, 3.6 + d * .05); sc = lerp(.35, 1, E.outBack(p, 2)); a = E.out3(p); if (a <= 0) continue; }
      const p = PH[tileId(i, j)];
      const w = ts * sc;
      c.globalAlpha = wallFade * a;
      c.drawImage(big ? p.sq : mid ? p.md : p.sm, x - w / 2, y - w / 2, w, w);
    }
    c.restore();
  }
  // hero glow-ring while we can still find it, fading as it is lost
  const ringA = P(t, 3.7, 3.95) * (1 - P(t, 4.85, 5.1));
  if (ringA > 0) {
    const x = 540 + (0 - cx) * s, y = 960 + (0 - cy) * s;
    c.save(); c.strokeStyle = `rgba(255,200,140,${.9 * ringA})`; c.lineWidth = 6; shadowed(c, `rgba(255,170,90,${ringA})`, 30, 0, 0, () => { c.strokeRect(x - ts / 2 + 3, y - ts / 2 + 3, ts - 6, ts - 6); }); c.restore();
  }
  // forgetting: drain colour, darken
  const g = .92 * E.inOut3(P(t, 5.45, 6.35));
  if (g > 0) { c.save(); c.globalCompositeOperation = 'saturation'; c.globalAlpha = g; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H); c.restore(); }
  const dark = .32 * E.inOut3(P(t, 5.5, 6.4)) + .38 * E.out3(P(t, 6.88, 7.02)) + .3 * P(t, 7.6, 8.1);
  if (dark > 0) { c.fillStyle = `rgba(4,4,10,${Math.min(.95, dark)})`; c.fillRect(0, 0, W, H); }
  // fog of a thousand photos
  const fog = P(t, 5.8, 6.5) * (1 - P(t, 6.88, 7.2));
  if (fog > 0) { const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(6,6,10,${.85 * fog})`); gr.addColorStop(.3, 'rgba(6,6,10,0)'); gr.addColorStop(.7, 'rgba(6,6,10,0)'); gr.addColorStop(1, `rgba(6,6,10,${.85 * fog})`); c.fillStyle = gr; c.fillRect(0, 0, W, H); }

  // twinkling moments
  for (const k of GAL.twinkles) {
    const p = P(t, k.t, k.t + .2), q = 1 - P(t, 7.42, 7.62);
    const a = E.out3(p) * q; if (a <= 0) continue;
    const x = 540 + (k.i - cx) * s, y = 960 + (k.j - cy) * s;
    const w = ts * (1 + .7 * E.outBack(p, 2.4) * q);
    c.save(); c.globalAlpha = a;
    shadowed(c, 'rgba(255,190,120,.9)', 40, 0, 0, () => c.drawImage(PH[k.id].md, x - w / 2, y - w / 2, w, w));
    c.restore();
  }
  // the one moment
  if (t > 6.85) {
    const p = P(t, 6.88, 7.18);
    const x = 540 + (si - cx) * s, y = 960 + (sj - cy) * s;
    const dive = E.inOut3(P(t, 7.45, 8.15));
    const pop = 1 + .95 * E.outBack(p, 2.2) * (1 - dive);
    const w = ts * pop;
    const breathe = .8 + .2 * Math.sin((t - 6.88) * 6);
    glow(c, x, y, w * 2.6, 'rgba(255,170,100,.9)', .55 * E.out3(p) * breathe * (1 - dive));
    c.save();
    shadowed(c, `rgba(255,180,110,${.9 * (1 - dive)})`, 50 * (1 - dive), 0, 0, () => c.drawImage(w > 150 ? PH[HERO].sq : PH[HERO].md, x - w / 2, y - w / 2, w, w));
    c.restore();
    if (dive < 1) { c.strokeStyle = `rgba(255,255,255,${.85 * (1 - dive)})`; c.lineWidth = 3; c.strokeRect(x - w / 2, y - w / 2, w, w); }
  }
}

/* =========================================================
   ACT 3 — just a picture on a phone… then it lifts out
   ========================================================= */
const PHONE = { w: 664, h: 1364, r: 104, inset: 24 };
function phoneMatrix(t) {
  const yaw = -.17 * E.inOut3(P(t, 8.3, 8.95)) + .27 * E.inOut3(P(t, 8.95, 9.75)) - .1 * E.inOut3(P(t, 9.75, 10.5));
  const sc = lerp(1, .9, E.inOut3(P(t, 8.25, 8.95)));
  const fy = Math.sin((t - 8.2) * 1.8) * 8 * P(t, 8.3, 8.8);
  const exitY = 1600 * E.in3(P(t, 9.9, 10.75));
  const roll = .22 * E.in3(P(t, 9.9, 10.75));
  const a = Math.cos(yaw) * sc, b = Math.sin(yaw) * .16 * sc, d = sc;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return [cr * a - sr * b, sr * a + cr * b, -sr * d, cr * d, 540, 960 + fy + exitY];
}
function phonePhotoRect() { const w = PHONE.w - PHONE.inset * 2; return { w, h: w * .75 }; }

function act3(c, t) {
  // background: cool screen-lit dark → warm
  const warm = E.inOut3(P(t, 9.75, 10.6));
  c.fillStyle = '#06060a'; c.fillRect(0, 0, W, H);
  glow(c, 540, 960, 900, 'rgba(110,140,255,.5)', .16 * P(t, 8.2, 8.6) * (1 - warm));
  warmBG(c, t, warm);
  glow(c, 540, 930, 1000, 'rgba(255,176,110,.7)', .3 * warm);
  motes(c, t, warm);

  const M = phoneMatrix(t);
  const body = E.out3(P(t, 8.12, 8.42));
  const trace = E.inOut3(P(t, 7.92, 8.32));
  const phA = 1 - P(t, 10.25, 10.75);
  const lift = E.inOut3(P(t, 9.5, 10.45));
  if (phA > 0) {
    c.save(); c.setTransform(...M); c.translate(...shake(t)); c.globalAlpha = phA;
    const { w, h, r, inset } = PHONE;
    // body
    if (body > 0) {
      c.save(); c.globalAlpha = phA * body;
      shadowed(c, 'rgba(0,0,0,.7)', 80, 0, 40, () => { rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = '#121218'; c.fill(); });
      const g = c.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, '#5b5d6b'); g.addColorStop(.08, '#22232b'); g.addColorStop(.92, '#22232b'); g.addColorStop(1, '#5b5d6b');
      rr(c, -w / 2, -h / 2, w, h, r); c.fillStyle = g; c.fill();
      rr(c, -w / 2 + inset - 6, -h / 2 + inset - 6, w - (inset - 6) * 2, h - (inset - 6) * 2, r - 18); c.fillStyle = '#050507'; c.fill();
      rr(c, -w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, r - 24); c.fillStyle = '#000'; c.fill();
      // side buttons
      c.fillStyle = '#3a3b46'; c.fillRect(w / 2 - 2, -260, 8, 150); c.fillRect(-w / 2 - 6, -330, 8, 90); c.fillRect(-w / 2 - 6, -210, 8, 90);
      c.restore();
    }
    // outline trace
    if (trace > 0 && body < 1) {
      rr(c, -w / 2, -h / 2, w, h, r);
      const L = 2 * (w + h);
      c.setLineDash([L * trace, L]); c.lineDashOffset = -L * .12;
      c.strokeStyle = `rgba(200,205,225,${(1 - body) * .9})`; c.lineWidth = 5; c.stroke(); c.setLineDash([]);
    }
    // screen UI
    const ui = P(t, 8.3, 8.6) * (1 - P(t, 9.4, 9.7));
    if (ui > 0) phoneUI(c, t, ui);
    c.restore();
  }
  // the photo sits under the glass until it starts to rise
  if (t >= 8.15 && t < 9.5) drawHeroPrint(c, t, M);
  if (phA > 0) {
    c.save(); c.setTransform(...M); c.translate(...shake(t)); c.globalAlpha = phA;
    const { w, h, r, inset } = PHONE;
    // glass reflection
    const gl = P(t, 8.45, 9.3);
    if (gl > 0 && gl < 1) {
      c.save(); rr(c, -w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2, r - 24); c.clip();
      const x = lerp(-w * 1.3, w * 1.3, E.inOut3(gl));
      const g = c.createLinearGradient(x - 220, -h / 2, x + 220, h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.13)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(-w / 2, -h / 2, w, h); c.restore();
    }
    // dynamic island
    if (body > 0) { rr(c, -92, -h / 2 + inset + 22, 184, 54, 27); c.fillStyle = `rgba(0,0,0,${body})`; c.fill(); }
    c.restore();
  }
  // the photo (inside the phone, then rising out as a paper print)
  if (t >= 9.5 && t < 10.8) drawHeroPrint(c, t, M);
}

function phoneUI(c, t, a) {
  const { w, h, inset } = PHONE;
  c.save(); c.globalAlpha *= a;
  const top = -h / 2 + inset, bot = h / 2 - inset;
  c.strokeStyle = '#d8dbe6'; c.fillStyle = '#d8dbe6'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
  // back chevron + menu dots
  c.beginPath(); c.moveTo(-232, top + 150); c.lineTo(-254, top + 172); c.lineTo(-232, top + 194); c.stroke();
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(214 + i * 18, top + 172, 4.5, 0, TAU); c.fill(); }
  // small pill (date placeholder)
  rr(c, -90, top + 160, 180, 22, 11); c.fillStyle = 'rgba(216,219,230,.35)'; c.fill();
  // thumbnail strip
  const sy = bot - 220, n = 11;
  for (let k = 0; k < n; k++) {
    const off = k - 5; const id = off === 0 ? HERO : IDS[(k * 7 + 3) % IDS.length];
    const s = off === 0 ? 70 : 50; const x = off * 54 + (off > 0 ? 10 : off < 0 ? -10 : 0);
    c.globalAlpha = a * (off === 0 ? 1 : .75);
    c.drawImage(PH[id].sm, x - s / 2, sy - s / 2, s, s);
  }
  c.globalAlpha = a;
  // toolbar icons
  const iy = bot - 100; c.strokeStyle = '#d8dbe6'; c.lineWidth = 5;
  c.beginPath(); c.moveTo(-230, iy - 10); c.lineTo(-230, iy + 22); c.lineTo(-198, iy + 22); c.lineTo(-198, iy - 10); c.moveTo(-214, iy - 22); c.lineTo(-214, iy + 8); c.moveTo(-226, iy - 12); c.lineTo(-214, iy - 24); c.lineTo(-202, iy - 12); c.stroke();
  c.beginPath(); c.moveTo(-70, iy + 18); c.bezierCurveTo(-110, iy - 10, -90, iy - 34, -70, iy - 14); c.bezierCurveTo(-50, iy - 34, -30, iy - 10, -70, iy + 18); c.stroke();
  c.beginPath(); c.arc(70, iy, 22, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(70, iy - 2); c.lineTo(70, iy + 10); c.stroke(); c.beginPath(); c.arc(70, iy - 11, 2.5, 0, TAU); c.fill();
  c.beginPath(); c.moveTo(196, iy - 14); c.lineTo(232, iy - 14); c.moveTo(202, iy - 14); c.lineTo(205, iy + 22); c.lineTo(223, iy + 22); c.lineTo(226, iy - 14); c.moveTo(208, iy - 14); c.lineTo(210, iy - 22); c.lineTo(218, iy - 22); c.lineTo(220, iy - 14); c.stroke();
  c.restore();
}

// hero print pose in screen space after leaving the phone
const PRINT = { cx: 540, cy: 930, w: 760, h: 570, border: 30, rot: -.05 };
function drawHeroPrint(c, t, Mphone) {
  const { w: pw, h: ph } = phonePhotoRect();
  const lift = E.inOut3(P(t, 9.5, 10.45));
  const morph = E.inOut3(P(t, 8.15, 8.5));            // square tile → 4:3 photo
  const toSlot = E.inOut3(P(t, 10.8, 11.3));
  // matrices
  const bob = Math.sin(t * 1.6) * 10 * P(t, 10.2, 10.6);
  const Mp = [Math.cos(PRINT.rot), Math.sin(PRINT.rot), -Math.sin(PRINT.rot), Math.cos(PRINT.rot), PRINT.cx, PRINT.cy + bob];
  let M = lerpM(Mphone, Mp, lift);
  const zoomBump = 1 + .14 * Math.sin(lift * Math.PI);
  let w = lerp(lerp(616, pw, morph), PRINT.w, lift) * zoomBump;
  let h = lerp(lerp(616, ph, morph), PRINT.h, lift) * zoomBump;
  let cr = lerpM(crop(HERO, 1), crop(HERO, 4 / 3), morph);
  let border = PRINT.border * E.out3(P(t, 9.75, 10.35));
  let rad = 0, bcol = 'paper';
  if (toSlot > 0) {
    const sp = slotPose(0, t);
    const Ms = [Math.cos(sp.ang), Math.sin(sp.ang), -Math.sin(sp.ang), Math.cos(sp.ang), sp.x, sp.y];
    M = lerpM(M, Ms, toSlot);
    w = lerp(w, sp.size, toSlot); h = lerp(h, sp.size, toSlot);
    cr = lerpM(cr, crop(HERO, 1), toSlot);
    border = lerp(border, 6, toSlot); rad = lerp(0, sp.size * .2, toSlot);
  }
  c.save(); c.setTransform(...M);
  if (t < 9.5) c.translate(...shake(t));
  const bw = w + border * 2, bh = h + border * 2;
  const shA = Math.max(lift, toSlot);
  if (shA > 0) shadowed(c, `rgba(5,4,20,${.55 * shA})`, 30 + 60 * Math.sin(lift * Math.PI * .5 + .2), 0, 20 + 30 * lift * (1 - toSlot), () => { rr(c, -bw / 2, -bh / 2, bw, bh, rad + border * .3); c.fillStyle = '#000'; c.fill(); });
  if (border > .5) {
    rr(c, -bw / 2, -bh / 2, bw, bh, rad + border * .3); c.save(); c.clip();
    c.fillStyle = toSlot > .5 ? '#fbf8f2' : '#f6f1e6'; c.fillRect(-bw / 2, -bh / 2, bw, bh);
    c.globalAlpha = .6 * (1 - toSlot); c.drawImage(PAPER, -bw / 2, -bh / 2, bw, bh); c.restore();
  }
  c.save(); rr(c, -w / 2, -h / 2, w, h, rad); c.clip();
  // "just pixels" — pixelation pulse
  const px = P(t, B.mojarrad, B.soora + .05);
  const blk = px > 0 && px < 1 ? 1 + 22 * Math.pow(Math.sin(px * Math.PI), 1.4) : 1;
  if (blk > 1.5) {
    const sw = Math.max(2, Math.round(w / blk)), sh = Math.max(2, Math.round(h / blk));
    const tmp = mk(sw, sh, x => x.drawImage(PH[HERO].img, cr[0], cr[1], cr[2], cr[3], 0, 0, sw, sh));
    c.imageSmoothingEnabled = false; c.drawImage(tmp, -w / 2, -h / 2, w, h); c.imageSmoothingEnabled = true;
  } else drawCrop(c, HERO, cr, -w / 2, -h / 2, w, h);
  // subpixel scanlines while it is still "just a picture"
  const sl = P(t, 8.75, 9.0) * (1 - P(t, 9.35, 9.8));
  if (sl > 0) {
    c.globalAlpha = .28 * sl; c.globalCompositeOperation = 'multiply';
    for (let x = -w / 2; x < w / 2; x += 9) { c.fillStyle = '#ff4040'; c.fillRect(x, -h / 2, 3, h); c.fillStyle = '#40ff40'; c.fillRect(x + 3, -h / 2, 3, h); c.fillStyle = '#4060ff'; c.fillRect(x + 6, -h / 2, 3, h); }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  // cold screen tint → warm print
  const cool = P(t, 8.2, 8.6) * (1 - lift);
  if (cool > 0) { c.fillStyle = `rgba(60,90,170,${.16 * cool})`; c.fillRect(-w / 2, -h / 2, w, h); }
  c.restore();
  c.restore();
}

/* =========================================================
   ACT 4 — the Ulfa photo wheel, then the envelope + seal
   ========================================================= */
const WR = 450, SLOT_R = 300, SLOT_S = 196;
function wheelState(t) {
  let cx = 540, cy = 1000, gs = 1 + .1 * E.inOut3(P(t, B.aqrab, 11.75));
  const a = E.inOut3(P(t, 12.2, 12.62));
  gs = lerp(gs, .54, a); cy = lerp(cy, 860, a);
  cy = lerp(cy, 1222, E.inOut3(P(t, 12.6, 13.0)));
  const rot = -(Math.PI / 4) * (spring(t - 11.62, 10, 19) + spring(t - 12.02, 10, 19));
  return { cx, cy, gs, rot };
}
function slotPose(k, t) {
  const ws = wheelState(t);
  const th = -Math.PI / 2 + k * Math.PI / 4 + ws.rot;
  let d = Math.abs(((th + Math.PI / 2) % TAU + TAU + Math.PI) % TAU - Math.PI);
  const act = E.inOutSine(clamp(1 - d / (Math.PI / 4)));
  const rad = (SLOT_R + 44 * act) * ws.gs;
  return { x: ws.cx + Math.cos(th) * rad, y: ws.cy + Math.sin(th) * rad, ang: th + Math.PI / 2, size: (SLOT_S + 70 * act) * ws.gs, act };
}
function drawWheel(c, t, alpha = 1) {
  const ws = wheelState(t);
  const p = P(t, B.lazem, 11.28);
  const sc = lerp(.35, 1, E.outBack(p, 1.4));
  const spin = (1 - E.out3(p)) * -1.2;
  const a = E.out3(clamp(p * 2)) * alpha;
  if (a <= 0) return;
  c.save(); c.globalAlpha = a;
  c.translate(ws.cx, ws.cy); c.scale(ws.gs * sc, ws.gs * sc); c.rotate(ws.rot + spin);
  shadowed(c, 'rgba(5,4,20,.55)', 70, 0, 30, () => { c.beginPath(); c.arc(0, 0, WR, 0, TAU); c.fillStyle = COL.disk; c.fill(); });
  const g = c.createRadialGradient(-80, -120, 40, 0, 0, WR);
  g.addColorStop(0, '#f4efe6'); g.addColorStop(.75, '#e8e1d5'); g.addColorStop(1, '#d9d0c1');
  c.beginPath(); c.arc(0, 0, WR, 0, TAU); c.fillStyle = g; c.fill();
  c.save(); c.clip(); c.globalAlpha = a * .5; c.globalCompositeOperation = 'multiply'; c.drawImage(PAPER, -WR, -WR, WR * 2, WR * 2); c.restore();
  // notched rim
  c.lineWidth = 34; c.strokeStyle = '#d6ccbc';
  for (let i = 0; i < 16; i++) { const a0 = i * TAU / 16 + .05, a1 = (i + 1) * TAU / 16 - .05; c.beginPath(); c.arc(0, 0, WR - 20, a0, a1); c.stroke(); }
  c.lineWidth = 3; c.strokeStyle = 'rgba(40,39,73,.55)'; c.beginPath(); c.arc(0, 0, WR - 44, 0, TAU); c.stroke();
  // index dots
  c.fillStyle = 'rgba(40,39,73,.45)';
  for (let i = 0; i < 8; i++) { const an = -Math.PI / 2 + i * Math.PI / 4 + Math.PI / 8; c.beginPath(); c.arc(Math.cos(an) * 170, Math.sin(an) * 170, 5, 0, TAU); c.fill(); }
  // centre hole
  c.beginPath(); c.arc(0, 0, 92, 0, TAU); c.fillStyle = '#cfc6b6'; c.fill();
  c.beginPath(); c.arc(0, 0, 74, 0, TAU); c.fillStyle = '#1b1a35'; c.fill();
  c.restore();
  // marker (fixed, not rotating)
  c.save(); c.globalAlpha = a; c.translate(ws.cx, ws.cy - 172 * ws.gs * sc); c.scale(ws.gs * sc, ws.gs * sc);
  const tick = Math.max(Math.exp(-Math.max(0, t - 11.62) * 8) * (t > 11.62 ? 1 : 0), Math.exp(-Math.max(0, t - 12.02) * 8) * (t > 12.02 ? 1 : 0));
  c.fillStyle = COL.navy; c.beginPath(); c.moveTo(0, -22); c.lineTo(16, 6); c.lineTo(-16, 6); c.closePath(); c.fill();
  c.fillRect(-2.5, 6, 5, 34);
  c.restore();
  if (tick > 0) glow(c, ws.cx, ws.cy - (WR - 30) * ws.gs, 160 * ws.gs, 'rgba(255,220,170,.9)', .5 * tick);
  // slots
  const order = [1, 2, 3, 4, 5, 6, 7, 0].sort((x, y) => slotPose(x, t).act - slotPose(y, t).act);
  for (const k of order) {
    if (k === 0 && t < 11.32) continue;               // hero handled by drawHeroPrint
    const sp = slotPose(k, t);
    let x = sp.x, y = sp.y, ang = sp.ang, s = sp.size * sc, al = a;
    if (k > 0) {
      const fp = P(t, 10.86 + k * .045, 11.3 + k * .045);
      if (fp <= 0) continue;
      const e = E.out3(fp);
      const dir = sp.ang - Math.PI / 2 + .9;
      const sx = ws.cx + Math.cos(dir) * 1500, sy = ws.cy + Math.sin(dir) * 1500 - 300;
      x = lerp(sx, ws.cx + (sp.x - ws.cx) * sc, e); y = lerp(sy, ws.cy + (sp.y - ws.cy) * sc, e);
      ang = lerp(sp.ang + 2.6 * (k % 2 ? 1 : -1), sp.ang, e); s = s * lerp(1.7, 1, e);
      al = a * clamp(fp * 3);
    } else { x = ws.cx + (sp.x - ws.cx) * sc; y = ws.cy + (sp.y - ws.cy) * sc; }
    c.save(); c.globalAlpha = al; c.translate(x, y); c.rotate(ang);
    const bd = 6 * (s / SLOT_S);
    shadowed(c, `rgba(5,4,20,${.35 + .25 * sp.act})`, 18 + 26 * sp.act, 0, 8 + 10 * sp.act, () => { rr(c, -s / 2 - bd, -s / 2 - bd, s + bd * 2, s + bd * 2, s * .2 + bd); c.fillStyle = '#fbf8f2'; c.fill(); });
    rr(c, -s / 2, -s / 2, s, s, s * .2); c.clip();
    c.drawImage(s > 180 ? PH[WHEEL[k]].sq : PH[WHEEL[k]].md, -s / 2, -s / 2, s, s);
    c.restore();
  }
}

const ENV = { w: 940, h: 620 };
function envState(t) {
  const ey = lerp(2750, 1150, E.out3(P(t, 12.25, 12.72)));
  const settle = 1 + .014 * Math.sin(P(t, 13.4, 13.7) * Math.PI);
  const flap = E.inOut3(P(t, 12.98, 13.45));
  return { ey, settle, flap };
}
function envPattern(c, x, y, w, h) {
  c.drawImage(ENVTEX, x, y, w, h);
}
function drawEnvelopeBack(c, t, es) {
  const { w, h } = ENV, L = 540 - w / 2, top = es.ey - h / 2;
  shadowed(c, 'rgba(60,20,30,.35)', 70, 0, 34, () => { rr(c, L, top, w, h, 12); c.fillStyle = '#1e1d3b'; c.fill(); });
  c.save(); rr(c, L, top, w, h, 12); c.clip(); envPattern(c, L, top, w, h); c.fillStyle = 'rgba(8,8,24,.35)'; c.fillRect(L, top, w, h); c.restore();
  // open flap (inner face) behind the contents
  const apex = top + lerp(-.52 * h, .58 * h, es.flap);
  if (apex < top) {
    const k = (top - apex) / (.52 * h);
    c.save(); c.beginPath(); c.moveTo(L + 2, top + 2); c.lineTo(540, apex); c.lineTo(L + w - 2, top + 2); c.closePath(); c.clip();
    envPattern(c, L, apex, w, top - apex + 4);
    c.fillStyle = `rgba(70,68,120,${.35 + .25 * (1 - k)})`; c.fillRect(L, apex, w, top - apex + 4);
    c.restore();
  }
}
function drawEnvelopeFront(c, t, es) {
  const { w, h } = ENV, L = 540 - w / 2, R = L + w, top = es.ey - h / 2, bot = es.ey + h / 2;
  const vy = top + h * .56, my = es.ey + 40;
  c.save();
  rr(c, L, top, w, h, 12); c.clip();
  // side flaps + bottom flap as one pocket
  c.beginPath(); c.moveTo(L, top + 6); c.lineTo(540, vy); c.lineTo(R, top + 6); c.lineTo(R, bot); c.lineTo(L, bot); c.closePath();
  c.save(); shadowed(c, 'rgba(0,0,0,.45)', 26, 0, -8, () => { c.fillStyle = COL.navy; c.fill(); }); c.restore();
  c.save(); c.clip(); envPattern(c, L, top, w, h);
  // bottom flap slightly lighter
  c.beginPath(); c.moveTo(L, bot); c.lineTo(540, my); c.lineTo(R, bot); c.closePath(); c.fillStyle = 'rgba(255,255,255,.035)'; c.fill();
  c.restore();
  // creases
  c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,10,.35)';
  c.beginPath(); c.moveTo(L + 4, bot - 2); c.lineTo(540, my); c.lineTo(R - 4, bot - 2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.09)'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(L + 6, top + 8); c.lineTo(540, vy + 1); c.lineTo(R - 6, top + 8); c.stroke();
  c.restore();
  // closed flap (outer face) on top
  const apex = top + lerp(-.52 * h, .58 * h, es.flap);
  if (apex >= top) {
    const k = (apex - top) / (.58 * h);
    c.save();
    c.beginPath(); c.moveTo(L, top); c.lineTo(540, apex); c.lineTo(R, top); c.closePath();
    shadowed(c, `rgba(0,0,10,${.55 * k})`, 24, 0, 10 * k, () => { c.fillStyle = COL.navy; c.fill(); });
    c.clip(); envPattern(c, L, top, w, Math.max(4, apex - top));
    c.fillStyle = `rgba(0,0,0,${.3 * (1 - k)})`; c.fillRect(L, top, w, apex - top);
    c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(L, top, w, apex - top);
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(L + 4, top + 2); c.lineTo(540, apex - 1); c.lineTo(R - 4, top + 2); c.stroke();
  }
}
function sealPose(t, es) {
  const top = es.ey - ENV.h / 2, tx = 540, ty = top + ENV.h * .58;
  const p = P(t, B.amilna, B.ulfa);
  const e = E.in3(p);
  const sc = lerp(3.4, 1, e), al = clamp(p * 3), blur = (1 - e) * 16, oy = -260 * (1 - e), rot = lerp(.6, 0, e);
  const squash = t > B.ulfa ? 1 - .1 * Math.exp(-(t - B.ulfa) * 11) * Math.cos((t - B.ulfa) * 34) : 1;
  return { x: tx, y: ty + oy, sc: sc * squash, al, blur, rot, p, e };
}
function drawSeal(c, t, es) {
  if (t < B.amilna) return;
  const s = sealPose(t, es), size = 214;
  // contact shadow
  c.save(); c.globalAlpha = .55 * s.e; c.filter = `blur(${(6 + (1 - s.e) * 26).toFixed(1)}px)`;
  c.fillStyle = '#000'; c.beginPath(); c.ellipse(s.x + 6, s.y + 14 + (1 - s.e) * 40, size * .46 * (1 + (1 - s.e) * .6), size * .42 * (1 + (1 - s.e) * .6), 0, 0, TAU); c.fill();
  c.restore();
  c.save(); c.globalAlpha = s.al; c.translate(s.x, s.y); c.rotate(s.rot); c.scale(s.sc, s.sc);
  if (s.blur > .4) c.filter = `blur(${s.blur.toFixed(1)}px)`;
  c.drawImage(SEAL, -size / 2, -size / 2, size, size);
  c.restore();
}
const BURST = (() => { const r = rng(99); return Array.from({ length: 54 }, () => ({ a: r() * TAU, v: 380 + r() * 900, s: 3 + r() * 9, c: r(), sp: r() * 8 - 4 })); })();
function impact(c, t, es) {
  const d = t - B.ulfa; if (d < 0 || d > 1.6) return;
  const s = sealPose(t, es);
  glow(c, s.x, s.y, 700, 'rgba(255,215,170,.9)', .55 * Math.exp(-d * 5));
  // shockwave
  if (d < .7) { const p = d / .7; c.save(); c.strokeStyle = `rgba(255,248,236,${.75 * (1 - p)})`; c.lineWidth = 6 * (1 - p) + 1; c.beginPath(); c.arc(s.x, s.y, 110 + 620 * E.out3(p), 0, TAU); c.stroke(); c.restore(); }
  // particles
  c.save();
  for (const b of BURST) {
    const k = Math.min(d, 1.4), dist = b.v * (1 - Math.exp(-k * 3.2)) / 3.2;
    const x = s.x + Math.cos(b.a) * (100 + dist), y = s.y + Math.sin(b.a) * (100 + dist) + 90 * k * k;
    const a = clamp(1 - d / 1.3);
    c.globalAlpha = a; c.fillStyle = b.c < .45 ? COL.cream : b.c < .8 ? COL.rose : '#a33447';
    c.save(); c.translate(x, y); c.rotate(b.sp * d); c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); c.restore();
  }
  c.restore();
}
function nfcWaves(c, t, es, starts) {
  const s = sealPose(t, es);
  for (const t0 of starts) for (let n = 0; n < 3; n++) {
    const p = P(t, t0 + n * .11, t0 + n * .11 + 1.0); if (p <= 0 || p >= 1) continue;
    const r = 150 + 340 * E.out3(p), a = (1 - p) * .85;
    c.save(); c.lineCap = 'round'; c.lineWidth = 7 * (1 - p * .6);
    c.strokeStyle = `rgba(243,238,227,${a})`;
    shadowed(c, `rgba(122,31,46,${a * .6})`, 12, 0, 0, () => {
      c.beginPath(); c.arc(s.x, s.y, r, -.55, .55); c.stroke();
      c.beginPath(); c.arc(s.x, s.y, r, Math.PI - .55, Math.PI + .55); c.stroke();
    });
    c.restore();
  }
}

/* ---------- end card ---------- */
let WORD;
function wordmark() {
  if (WORD) return WORD;
  WORD = mk(1080, 460, c => {
    c.fillStyle = COL.navy; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.direction = 'rtl';
    c.font = '700 300px Amiri'; c.fillText('ألفة', 540, 330);
  });
  return WORD;
}
function ornament(c, cx, cy, p, col) {
  if (p <= 0) return;
  c.save(); c.strokeStyle = col; c.lineCap = 'round';
  const lp = E.out3(P(p, .25, 1));
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(cx - 74, cy); c.lineTo(cx - 74 - 190 * lp, cy); c.moveTo(cx + 74, cy); c.lineTo(cx + 74 + 190 * lp, cy); c.stroke();
  // interlaced double loop (the seal's monogram)
  const lo = E.inOut3(P(p, 0, .8)); const a = 44, N = 120;
  c.lineWidth = 3.5; c.beginPath();
  for (let i = 0; i <= N * lo; i++) {
    const u = i / N * TAU + Math.PI / 2; const den = 1 + Math.sin(u) ** 2;
    const x = cx + a * 1.45 * Math.cos(u) / den, y = cy + a * Math.sin(u) * Math.cos(u) / den * 1.6;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke(); c.restore();
}

function act4(c, t) {
  warmBG(c, t, 1);
  glow(c, 540, 980, 1000, 'rgba(255,176,110,.7)', .28 + .1 * E.inOut3(P(t, B.aqrab, 11.7)));
  motes(c, t, 1 - P(t, 12.2, 12.6));
  // blush iris wipe
  const wr = 2300 * E.inOut3(P(t, 12.16, 12.66));
  if (wr > 0) {
    c.save(); c.beginPath(); c.arc(540, 1120, wr, 0, TAU);
    c.fillStyle = COL.blush; c.fill();
    c.clip();
    const g = c.createRadialGradient(540, 900, 100, 540, 1000, 1300);
    g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(180,130,130,.28)');
    c.fillStyle = g; c.fillRect(-150, -150, W + 300, H + 300);
    c.restore();
    if (wr < 2300) { c.save(); c.strokeStyle = 'rgba(255,240,230,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(540, 1120, wr, 0, TAU); c.stroke(); c.restore(); }
  }
  const es = envState(t);
  // end-card camera: pull the sealed envelope up and back
  const ec = E.inOut3(P(t, 14.32, 15.05));
  c.save();
  c.translate(540, lerp(1150, 790, ec)); c.scale(lerp(1, .64, ec), lerp(1, .64, ec)); c.translate(-540, -1150);
  c.translate(540, es.ey); c.scale(es.settle, 2 - es.settle); c.translate(-540, -es.ey);
  if (t > 12.2) drawEnvelopeBack(c, t, es);
  if (t < 13.4) {
    if (t > 12.2) { c.save(); c.beginPath(); c.rect(540 - ENV.w / 2 + 8, -2000, ENV.w - 16, es.ey + ENV.h / 2 - 8 + 2000); c.clip(); drawWheel(c, t); c.restore(); }
    else drawWheel(c, t);
  }
  if (t > 12.2) { drawEnvelopeFront(c, t, es); drawSeal(c, t, es); nfcWaves(c, t, es, [14.04, 15.55]); impact(c, t, es); }
  c.restore();
  // wordmark
  if (t > 14.4) {
    const wm = wordmark();
    const p = P(t, 14.5, 15.25);
    const rx = lerp(1180, -160, E.inOut3(p));
    const tmp = mk(1080, 460, x => {
      x.drawImage(wm, 0, 0);
      // shine
      const sp = P(t, 15.6, 16.35);
      if (sp > 0 && sp < 1) { const sx = lerp(1250, -170, E.inOut3(sp)); x.globalCompositeOperation = 'source-atop'; const g = x.createLinearGradient(sx - 130, 0, sx + 130, 0); g.addColorStop(0, 'rgba(255,230,200,0)'); g.addColorStop(.5, 'rgba(160,120,190,.75)'); g.addColorStop(1, 'rgba(255,230,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 1080, 460); }
      x.globalCompositeOperation = 'destination-in';
      const g = x.createLinearGradient(rx - 150, 0, rx + 150, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = g; x.fillRect(0, 0, 1080, 460);
    });
    const yy = 1170 + 36 * (1 - E.out3(p));
    c.save(); c.globalAlpha = E.out3(clamp(p * 1.6)); c.drawImage(tmp, 0, yy); c.restore();
    ornament(c, 540, 1660, P(t, 14.95, 15.6), COL.wine);
    const lp = E.out3(P(t, 15.2, 15.8));
    if (lp > 0) {
      c.save(); c.globalAlpha = lp; c.fillStyle = COL.wine; c.textAlign = 'center';
      c.font = '600 60px "Cormorant Garamond"'; c.letterSpacing = '26px';
      c.fillText('ULFA', 540 + 13, 1772 + 22 * (1 - lp)); c.restore();
    }
  }
  vignette(c, t > 12.5 ? .18 : .45, t > 12.5 ? '120,70,80' : '0,0,0');
}

/* =========================================================
   master
   ========================================================= */
function renderScene(c, t) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const [sx, sy] = shake(t);
  c.save(); c.translate(sx, sy);
  if (t < 3.62) act1Background(c, t);
  if (t > 3.22 && t < 8.2) act2(c, t);
  if (t < 3.62) act1Foreground(c, t);
  if (t > 3.22 && t < 8.15) vignette(c, .5 * P(t, 3.3, 3.62));
  c.restore();
  if (t >= 8.15 && t < 10.8) act3(c, t);
  else if (t >= 7.9 && t < 8.15) { c.save(); act3Overlay(c, t); c.restore(); }
  if (t >= 10.8) { c.save(); c.translate(...shake(t)); act4(c, t); c.restore(); if (t < 11.32) drawHeroPrint(c, t, phoneMatrix(t)); }
  if (t >= 8.15 && t < 10.8) vignette(c, .45);
}
// during 7.9–8.15 the phone outline traces in over the diving gallery
function act3Overlay(c, t) {
  const M = phoneMatrix(t);
  const trace = E.inOut3(P(t, 7.92, 8.32));
  c.setTransform(...M);
  const { w, h, r } = PHONE; rr(c, -w / 2, -h / 2, w, h, r);
  const L = 2 * (w + h); c.setLineDash([L * trace, L]); c.lineDashOffset = -L * .12;
  c.strokeStyle = 'rgba(200,205,225,.9)'; c.lineWidth = 5; c.stroke(); c.setLineDash([]);
}

function samplesAt(t) {
  const fast = [[1.08, 1.4, 4], [1.28, 2.05, 3], [3.22, 3.65, 3], [4.95, 6.3, 7], [7.45, 8.2, 5], [9.5, 10.75, 3], [10.8, 11.45, 4], [11.6, 11.8, 4], [12.0, 12.2, 4], [12.2, 13.0, 3], [13.7, 14.2, 4]];
  let n = 1; for (const [a, b, k] of fast) if (t >= a && t <= b) n = Math.max(n, k);
  return n;
}

function renderFrame(t) {
  const n = samplesAt(t);
  if (n === 1) renderScene(out, t);
  else {
    const span = (1 / FPS) * .55;
    for (let k = 0; k < n; k++) {
      const ts = t + ((k + .5) / n - .5) * span;
      renderScene(wctx, ts);
      out.setTransform(1, 0, 0, 1, 0, 0); out.filter = 'none'; out.globalCompositeOperation = 'source-over';
      out.globalAlpha = 1 / (k + 1); out.drawImage(work, 0, 0);
    }
    out.globalAlpha = 1;
  }
  // film grain
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.save(); out.globalCompositeOperation = 'overlay'; out.globalAlpha = .085;
  out.drawImage(GRAIN[Math.floor(t * 24) % GRAIN.length], 0, 0, W, H); out.restore();
}

window.renderFrame = renderFrame;
window.DUR = DUR; window.FPS = FPS;
window.ready = load().then(() => { renderFrame(0); return true; });

// interactive preview: ?t=seconds or ?play
window.ready.then(() => {
  const q = new URLSearchParams(location.search);
  if (q.has('t')) { renderFrame(parseFloat(q.get('t'))); return; }
  if (q.has('play')) {
    const au = new Audio('assets/vo.wav'); const t0 = performance.now(); au.play().catch(() => {});
    const tick = () => { const t = (performance.now() - t0) / 1000; if (t > DUR) return; renderFrame(t); document.getElementById('ui').textContent = t.toFixed(2); requestAnimationFrame(tick); };
    tick();
  }
});
