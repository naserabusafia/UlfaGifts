// Run against the Vite dev server using an existing Playwright installation.
import assert from 'node:assert/strict';
import process from 'node:process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5175';
let assertions = 0;

async function setup({ count = 30, width = 360, language = 'en', ordered = false, reduced = false, longLetter = false, wheelBefore = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = Element.prototype.scrollIntoView;
    window.sectionScrolls = [];
    Element.prototype.scrollIntoView = function (options) {
      if (this.dataset.sectionType) window.sectionScrolls.push({ type: this.dataset.sectionType, behavior: options?.behavior });
      return original.call(this, options);
    };
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const media = Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, mediaType: 'IMAGE', url: `${origin}/fixtures/full-${i}.svg`,
    thumbnailUrl: `${origin}/fixtures/thumb-${i}.svg`, displayOrder: i, caption: i % 2 ? null : `Caption ${i + 1}` })).reverse();
  await page.route('**/fixtures/*.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#989c87"/><circle cx="500" cy="200" r="100" fill="#e8d8b8"/><path d="M0 600L300 240 550 600Z" fill="#566568"/><text x="80" y="160" font-size="70" fill="white">${route.request().url().match(/(?:full|thumb)-(\d+)/)?.[1]}</text></svg>` }));
  await page.route('**/nfc-items/public/**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data:
    route.request().url().endsWith('/verify') ? {
      theme: 'DEFAULT', language, content: { title: 'Letter fixture', message: longLetter ? Array(30).fill('A whole memory to read before moving on.').join('\n\n') : 'Our letter stays as before.', signature: 'Us' },
      sections: [
        { id: 'wheel', key: 'photo_wheel', displayOrder: wheelBefore ? 5 : ordered ? 30 : null, title: 'Every picture holds a memory', message: 'Click on each photo to relive the moment.', media },
        { id: 'message', key: 'message', displayOrder: 10 },
        ...(ordered ? [{ id: 'next', key: 'timeline', displayOrder: 20, title: 'The actual next section', message: 'DB text' }] : []),
      ],
    } : { theme: 'DEFAULT', language, viewerAuthType: 'NONE' },
  }) }));
  await page.goto(`${origin}/nfc/ui-check`);
  await page.locator('.el-seal').waitFor();
  return { page, context, errors };
}

async function finishLetter(page) {
  assert.equal(await page.locator('[data-section-type]:not([data-section-type="message"]):not([hidden])').count(), 0, 'sections stay hidden before opening the letter');
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2), 'hidden sections do not leave a scrollable gap');
  await page.locator('.el-seal').click();
  await page.locator('.el-big-c').waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-section-type]')].every((node) => !node.hidden));
  assert.equal(await page.locator('.el-closeBtn').count(), 0);
  await page.waitForTimeout(500);
  // Read the whole text, then a downward scroll leaves the letter.
  await page.locator('.el-big-c').evaluate((node) => { node.scrollTop = node.scrollHeight; });
  await page.locator('.el-big-c').hover();
  await page.mouse.wheel(0, 450);
  await page.waitForFunction(() => window.scrollY > 100);
  await page.waitForTimeout(700);
  assert.equal(await page.locator('.el-overlay').count(), 1, 'letter stays unfolded in its section');
  assert.equal(await page.locator('.el-seal').isDisabled(), true);
  assert.ok(await page.locator('.el-overlay').evaluate((node) => node.getBoundingClientRect().bottom <= 2), 'letter never covers the next section');
}

try {
  if (!process.env.TEST_RTL_ONLY && !process.env.TEST_MESSAGE_ONLY) {
  for (const width of [360, 1280]) for (const count of [1, 5, 30]) {
    const { page, context, errors } = await setup({ count, width });
    assert.deepEqual(await page.locator('[data-section-type]').evaluateAll((nodes) => nodes.map((n) => n.dataset.sectionType)), ['message', 'photo_wheel']);
    await finishLetter(page);
    assert.equal(await page.evaluate(() => window.sectionScrolls[0].behavior), 'smooth');
    assert.ok(await page.locator('.photo-wheel').evaluate((node) => Math.abs(node.getBoundingClientRect().top) < 4));
    assert.equal(await page.locator('.photo-wheel__photo').count(), count);
    assert.ok(await page.locator('.photo-wheel').evaluate((node) => node.getBoundingClientRect().bottom <= window.innerHeight + 2), 'the complete section fits the viewport');
    assert.ok(await page.locator('.photo-wheel__canvas').evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      const disk = canvas.querySelector('.photo-wheel__disk').getBoundingClientRect();
      return disk.left >= bounds.left && disk.right <= bounds.right && disk.top >= bounds.top && disk.bottom <= bounds.bottom;
    }), 'the entire reel fits inside its canvas');
    assert.ok(await page.locator('.photo-wheel__canvas').evaluate((canvas) => {
      const bounds = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll('.photo-wheel__photo')].every((photo) => {
        const rect = photo.getBoundingClientRect();
        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
      });
    }), 'top and bottom photos are not clipped');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    const opener = page.locator('.photo-wheel__photo[aria-current="true"]');
    await opener.click();
    await page.getByRole('dialog').waitFor();
    assert.equal(await page.locator('.photo-card figure img').getAttribute('src'), `${origin}/fixtures/full-0.svg`);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), true);
    if (count > 1) {
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.photo-card figure img').getAttribute('src'), `${origin}/fixtures/full-1.svg`);
      assert.equal(await page.locator('.photo-card figcaption').count(), 0);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('.photo-card figure img').getAttribute('src'), `${origin}/fixtures/full-${count - 1}.svg`);
      await page.keyboard.press('ArrowRight');
    }
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-current')), 'true');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    if (count > 1) {
      // A non-active photo first rotates to the top without opening a dialog.
      await page.locator('.photo-wheel__photo').nth(1).click();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.equal(await page.locator('.photo-wheel__counter').textContent(), `2 / ${count}`);
      await page.locator('.photo-wheel__canvas').focus();
      await page.keyboard.press('ArrowLeft');
      const bounds = await page.locator('.photo-wheel__photo[aria-current="true"]').boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2 - 80, bounds.y + bounds.height / 2, { steps: 8 });
      await page.mouse.up();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.notEqual(await page.locator('.photo-wheel__counter').textContent(), `1 / ${count}`);
    }
    await page.waitForTimeout(550);
    assert.equal(await page.locator('.photo-wheel__canvas').evaluate((node) => node.scrollLeft), 0);
    if (count === 30) {
      await page.locator('.photo-wheel').evaluate((node) => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top, behavior: 'instant' }));
      await page.screenshot({ path: `tests/wheel-${width}.png` });
    }
    assert.deepEqual(errors, []);
    assertions++;
    console.log(`PASS ${count} photos at ${width}px: Message handoff, photo order, card, keyboard, focus, drag`);
    await context.close();
  }
  {
    const { page, context } = await setup({ ordered: true, reduced: true });
    await finishLetter(page);
    assert.ok(await page.locator('[data-section-type="timeline"]').evaluate((node) => Math.abs(node.getBoundingClientRect().top) < 4));
    assert.equal(await page.evaluate(() => window.sectionScrolls[0].behavior), 'instant');
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.scrollY > 800), 'user scrolling stays free after handoff');
    assert.equal(await page.evaluate(() => window.sectionScrolls.length), 1);
    assertions++;
    console.log('PASS backend next section, reduced motion, one-time auto-scroll');
    await context.close();
  }
  {
    const { page, context } = await setup();
    await page.locator('.el-seal').click();
    await page.locator('.el-big-c').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-section-type="photo_wheel"]').hidden);
    await page.evaluate(() => window.scrollTo(0, 180));
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.el-overlay').count(), 1);
    assert.equal(await page.locator('.el-seal').isDisabled(), true);
    assert.equal(await page.evaluate(() => window.scrollY), 180);
    assert.equal(await page.evaluate(() => window.sectionScrolls.length), 0);
    assertions++;
    console.log('PASS manual scrolling keeps the letter open without automatic handoff');
    await context.close();
  }
  {
    const { page, context } = await setup({ wheelBefore: true });
    assert.equal(await page.locator('.photo-wheel').isVisible(), false);
    await page.locator('.el-seal').click();
    await page.locator('.el-big-c').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-section-type="photo_wheel"]').hidden);
    await page.waitForTimeout(650);
    assert.ok(await page.locator('[data-section-type="message"]').evaluate((node) => Math.abs(node.getBoundingClientRect().top) < 4), 'revealing an earlier section preserves the open letter position');
    assert.deepEqual(await page.locator('[data-section-type]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sectionType)), ['photo_wheel', 'message']);
    assert.equal(await page.locator('.el-overlay').count(), 1);
    assertions++;
    console.log('PASS sections reveal only after opening and preserve backend order and reading position');
    await context.close();
  }
  }
  if (!process.env.TEST_RTL_ONLY) {
  for (const gesture of ['wheel', 'touch', 'keyboard']) {
    const { page, context } = await setup({ longLetter: true });
    await page.locator('.el-seal').click();
    await page.locator('.el-big-c').waitFor();
    await page.waitForTimeout(600);
    const text = page.locator('.el-big-c');
    assert.ok(await text.evaluate((node) => node.scrollHeight > node.clientHeight * 2));
    const cdp = await context.newCDPSession(page);
    const swipe = async () => {
      const bounds = await text.boundingBox();
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height * .7;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 20 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const scroll = async () => {
      if (gesture === 'touch') await swipe();
      else if (gesture === 'keyboard') await page.keyboard.press('PageDown');
      else { await text.hover(); await page.mouse.wheel(0, 180); }
    };
    await scroll();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.el-overlay').count(), 1, 'remaining text stays readable');
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    assert.ok(await text.evaluate((node) => node.scrollTop > 0));
    await text.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    await page.waitForTimeout(150);
    await scroll();
    await page.waitForFunction(() => Math.abs(document.querySelector('.photo-wheel').getBoundingClientRect().top) < 4);
    assert.equal(await page.locator('.el-overlay').count(), 1);
    assert.equal(await page.locator('.el-seal').isDisabled(), true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);
    assert.ok(await page.locator('.el-big-c').evaluate((node) => node.scrollTop > 0), 'returning preserves the open letter and reading position');
    await text.hover();
    await page.mouse.wheel(0, 200);
    await page.waitForFunction(() => window.scrollY > 0);
    assert.equal(await page.evaluate(() => window.sectionScrolls.length), 1);
    assert.equal(await page.locator('.el-closeBtn').count(), 0);
    assertions++;
    console.log(`PASS ${gesture} reads long letter then aligns next section, with the letter permanently open and no repeated handoff`);
    await context.close();
  }
  }
  if (!process.env.TEST_MESSAGE_ONLY) {
  {
    const { page, context } = await setup({ language: 'ar' });
    await finishLetter(page);
    assert.equal(await page.locator('.photo-wheel__heading').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('.photo-wheel__canvas').getAttribute('dir'), 'ltr');
    await page.locator('.photo-wheel__canvas').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.photo-wheel__counter').textContent(), '2 / 30');
    await page.waitForTimeout(550);
    const cdp = await context.newCDPSession(page);
    const activeBounds = await page.locator('.photo-wheel__photo[aria-current="true"]').boundingBox();
    const wheelX = activeBounds.x + activeBounds.width / 2;
    const wheelY = activeBounds.y + activeBounds.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: wheelX, y: wheelY }] });
    for (let step = 1; step <= 5; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: wheelX - step * 16, y: wheelY }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(550);
    assert.equal(await page.locator('.photo-wheel__counter').textContent(), '3 / 30');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('.photo-wheel__photo[aria-current="true"]').click();
    // Touch swipe uses the same Pointer Events path as mouse drag.
    const image = page.locator('.photo-card figure');
    await image.locator('img').evaluate(async (node) => { await node.decode(); });
    await page.waitForTimeout(300);
    // Use native touch events so Pointer Events can acquire pointer capture.
    const bounds = await image.boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width * .7, y: bounds.y + bounds.height / 2 }] });
    for (let step = 1; step <= 6; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + bounds.width * (.7 - step / 12), y: bounds.y + bounds.height / 2 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.photo-card__controls span').textContent(), '4 / 30');
    await page.locator('.photo-card-backdrop').click({ position: { x: 5, y: 5 } });
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.photoIndex), '2');
    await page.locator('.photo-wheel__photo[aria-current="true"]').click();
    const originalIndex = await page.locator('.photo-wheel__photo[aria-current="true"]').getAttribute('data-photo-index');
    for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.photoIndex), originalIndex);
    assertions++;
    console.log('PASS RTL visual directions, touch swipe, backdrop close');
    await context.close();
  }
  {
    const { page, context } = await setup({ count: 0 });
    assert.equal(await page.locator('.photo-wheel').count(), 0);
    assertions++;
    console.log('PASS empty wheel omitted');
    await context.close();
  }
  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const requests = [];
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/nfc-items/**', (route) => { requests.push(route.request().url()); return route.abort(); });
    await page.goto(`${origin}/nfc/demo?auth=NONE&lang=ar`);
    await page.locator('.el-seal').waitFor();
    await finishLetter(page);
    assert.equal(await page.locator('.photo-wheel__photo').count(), 30);
    await page.waitForFunction(() => [...document.querySelectorAll('.photo-wheel__photo img')].every((image) => image.complete && image.naturalWidth > 0));
    assert.deepEqual(requests, [], 'demo never requires a backend response');
    assert.equal(await page.locator('.photo-wheel__heading').getAttribute('dir'), 'rtl');
    await page.locator('.photo-wheel__photo[aria-current="true"]').click();
    await page.getByRole('dialog').waitFor();
    await page.locator('.photo-card figure img').evaluate(async (image) => { await image.decode(); });
    assert.ok((await page.locator('.photo-card figure img').getAttribute('src')).endsWith('-full.jpg'));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.locator('.photo-wheel').evaluate((node) => window.scrollTo({ top: window.scrollY + node.getBoundingClientRect().top, behavior: 'instant' }));
    await page.screenshot({ path: `tests/demo-wheel-${width}.png`, fullPage: false });
    assert.deepEqual(errors, []);
    assertions++;
    console.log(`PASS offline Arabic demo at ${width}px with 30 local photos and lightbox`);
    await context.close();
  }
  }
  console.log(`${assertions} browser scenarios passed`);
} finally {
  await browser.close();
}
