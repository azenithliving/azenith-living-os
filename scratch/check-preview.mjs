/**
 * Live check: a picture named in the conversation opens over the thread, zooms, and
 * closes with one press — on a phone screen.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3222';
const IMG = `${BASE}/placeholder-room.jpg`;
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));
const INPUT = 'input[placeholder*="لهجتك"]';

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 30000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 15 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
  console.log(`LOGIN ${p.url().includes('/admin') ? 'ok' : 'FAILED'}`);

  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(3500);

  const probe = `قياس معاينة ${Date.now()} — صورة من المتجر ${IMG}`;
  await p.fill(INPUT, probe);
  await p.press(INPUT, 'Enter');

  let thumb = false;
  for (let i = 0; i < 20 && !thumb; i++) {
    await p.waitForTimeout(2000);
    thumb = (await p.locator('[data-image-preview]').count()) > 0;
  }
  console.log(`THUMBNAIL rendered=${thumb}`);
  if (!thumb) throw new Error('no thumbnail appeared for the image in the conversation');

  await p.locator('[data-image-preview]').last().click();
  await p.waitForTimeout(1200);
  const overlay = p.locator('[data-zoom-overlay]');
  const open = (await overlay.count()) > 0 && (await overlay.first().isVisible());
  const widthAt1 = await p.locator('[data-zoom-overlay] img').getAttribute('style');
  console.log(`OVERLAY open=${open} style=${widthAt1}`);
  await p.screenshot({ path: 'scratch/preview-overlay.png' });

  await p.locator('[data-zoom-range]').fill('340');
  await p.waitForTimeout(700);
  const widthAt3 = await p.locator('[data-zoom-overlay] img').getAttribute('style');
  const pct = await p.locator('[data-zoom-overlay] span').last().textContent();
  console.log(`ZOOM style=${widthAt3} readout=${(pct || '').trim()}`);
  await p.screenshot({ path: 'scratch/preview-zoomed.png' });

  await p.locator('[data-zoom-overlay] button[title="إغلاق"]').click();
  await p.waitForTimeout(900);
  console.log(`CLOSED overlayStillThere=${await p.locator('[data-zoom-overlay]').count() > 0}`);
  console.log(`STILL IN THE SAME THREAD=${(await p.locator(INPUT).count()) > 0}`);
} catch (e) {
  console.log(`FAIL ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await b.close();
}
