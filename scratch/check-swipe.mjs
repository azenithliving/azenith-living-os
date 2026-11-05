/**
 * Live check: the horizontal swipe between employees, driven with real touch events
 * on a phone-sized viewport.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3222';
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

/** One gesture on the thread area: a start point, a mid point and an end point. */
function gesture(points) {
  const area = document.querySelector('[data-thread-area]');
  if (!area) return 'no thread area';
  const fire = (type, x, y) => {
    const touch = new Touch({ identifier: 1, target: area, clientX: x, clientY: y });
    area.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch],
      })
    );
  };
  fire('touchstart', points[0][0], points[0][1]);
  fire('touchmove', points[1][0], points[1][1]);
  fire('touchend', points[2][0], points[2][1]);
  return 'dispatched';
}

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));

const header = async () =>
  (((await p.locator('[data-chat-header]').first().textContent().catch(() => '')) || '')
    .replace(/\s+/g, ' ')
    .trim());

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

  await p.goto(`${BASE}/admin/v2/agents/ops?agent=ops-qa`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 45000 });
  await p.waitForTimeout(3500);
  console.log(`START ${p.url()} :: ${(await header()).slice(0, 34)}`);

  const steps = [
    ['swipe left  ', [[320, 420], [190, 421], [60, 422]]],
    ['swipe left  ', [[320, 420], [190, 421], [60, 422]]],
    ['swipe right ', [[60, 420], [195, 421], [330, 422]]],
    ['drag down   ', [[200, 200], [203, 450], [205, 700]]],
  ];

  for (const [label, points] of steps) {
    const before = p.url();
    console.log(`${label}: ${await p.evaluate(gesture, points)}`);
    await p.waitForTimeout(7000);
    const moved = p.url() !== before;
    console.log(`  ${moved ? 'moved to' : 'stayed on'} ${p.url()} :: ${(await header()).slice(0, 34)}`);
  }
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await b.close();
}
