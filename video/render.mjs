// Usage:
//   node render.mjs stills 0.5,1.2,3.4      -> stills/<t>.jpg
//   node render.mjs video [audio.wav] [out.mp4] [from] [to]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const FFMPEG = process.env.FFMPEG || execSync('python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"').toString().trim();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 600, height: 1000 } });
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.evaluate(() => window.ready);
const fontsOk = await page.evaluate(() => [document.fonts.check('700 100px Amiri', 'ألفة'), document.fonts.check('600 50px "Cormorant Garamond"')]);
console.log('fonts', fontsOk);

const grab = (t, q = .95) => page.evaluate(([t, q]) => { renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', q); }, [t, q])
  .then(u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));

const [mode = 'stills', ...rest] = process.argv.slice(2);
if (mode === 'sheet') {
  // contact sheet: node render.mjs sheet name.jpg 0.5,1,1.5 [cols]
  const ts = rest[1].split(',').map(Number), cols = Number(rest[2] || 6);
  const u = await page.evaluate(([ts, cols]) => {
    const tw = 360, th = 640, rows = Math.ceil(ts.length / cols);
    const s = document.createElement('canvas'); s.width = tw * cols; s.height = th * rows; const x = s.getContext('2d');
    ts.forEach((t, i) => { renderFrame(t); x.drawImage(document.getElementById('c'), (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect((i % cols) * tw, Math.floor(i / cols) * th, 90, 34); x.fillStyle = '#ff0'; x.font = '24px sans-serif'; x.fillText(t.toFixed(2), (i % cols) * tw + 8, Math.floor(i / cols) * th + 26); });
    return s.toDataURL('image/jpeg', .85);
  }, [ts, cols]);
  fs.writeFileSync(path.join(ROOT, rest[0]), Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
} else if (mode === 'stills') {
  fs.mkdirSync(path.join(ROOT, 'stills'), { recursive: true });
  for (const t of (rest[0] || '0.5,1.5,3,5,7,9,11,13,15').split(',').map(Number)) {
    const t0 = Date.now(); fs.writeFileSync(path.join(ROOT, 'stills', `${t.toFixed(2)}.jpg`), await grab(t, .9));
    console.log('still', t, Date.now() - t0, 'ms');
  }
} else {
  const audio = rest[0] || path.join(ROOT, 'assets', 'mix.wav');
  const outFile = rest[1] || path.join(ROOT, 'out', 'ulfa.mp4');
  const from = Number(rest[2] ?? 0), to = Number(rest[3] ?? await page.evaluate(() => window.DUR));
  const fps = await page.evaluate(() => window.FPS);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
  if (audio !== 'none') args.push('-ss', String(from), '-i', audio);
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
  if (audio !== 'none') args.push('-c:a', 'aac', '-b:a', '256k', '-t', String(to - from));
  args.push(outFile);
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
  const t0 = Date.now();
  for (let f = n0; f < n1; f++) {
    const buf = await grab(f / fps, .96);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${n1}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('wrote', outFile);
}
await browser.close();
server.close();
