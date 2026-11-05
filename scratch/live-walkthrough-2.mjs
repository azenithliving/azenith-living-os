/**
 * The second half of the human walk-through on the published site: the drawer's tool
 * actually answering, the drawer closing, the closed panel leaving nothing on screen,
 * the red strip, a second employee, the storefront, and the canvas numerals.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = 'https://azenith-living.vercel.app';
const DIR = 'scratch/live-proof';
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const log = [];
const say = (s) => { log.push(s); console.log(s); };
const shot = async (p, name) => { await p.screenshot({ path: `${DIR}/${name}.png` }); say(`SHOT ${name}.png`); };
const boxOf = async (p, sel) => {
  const box = await p.locator(sel).boundingBox().catch(() => null);
  return box ? { x: Math.round(box.x), right: Math.round(box.x + box.width), w: Math.round(box.width) } : null;
};

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));
p.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 90)));
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
  say(`login ${p.url().includes('/admin') ? 'ok' : 'FAILED'}`);

  // canvas numerals
  await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(10000);
  const head = ((await p.locator('header p').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  say(`canvas line: ${head}`);
  await shot(p, '13-canvas-arabic-digits');

  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(4000);

  const closedBox = await boxOf(p, '[data-actions-drawer]');
  say(`drawer closed geometry ${JSON.stringify(closedBox)} (right edge must be < 0)`);

  await p.click('[data-actions-toggle]');
  await p.waitForTimeout(1200);
  await p.locator('[data-actions-drawer] button:has-text("فحص صحة الصفحات")').first().click();
  let result = '';
  for (let i = 0; i < 25 && !result; i++) {
    await p.waitForTimeout(3000);
    result = ((await p.locator('[data-action-result]').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  }
  say(`tool really answered: ${result.slice(0, 130) || '(nothing)'}`);
  await shot(p, '14-tool-answered');

  await p.locator('[data-actions-drawer] button[title="إغلاق"]').click();
  await p.waitForTimeout(900);
  const afterClose = await boxOf(p, '[data-actions-drawer]');
  say(`drawer after the close button ${JSON.stringify(afterClose)}`);
  await shot(p, '15-drawer-closed');

  // the red strip
  const fired = await p.evaluate(async () => {
    const r = await fetch('/api/admin/ops?action=sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subaction: 'publish', event_type: 'anomaly_detected', source_agent: 'OPS-QA',
        target_agents: [], payload: { summary: 'صفحة الغرف بترد بخطأ في آخر ربع ساعة' },
      }),
    });
    return r.status;
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(7000);
  const banner = ((await p.locator('[data-emergency-banner]').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  say(`strip (raised through door http ${fired}): ${banner.slice(0, 120) || '(absent)'}`);
  await shot(p, '16-red-strip');
  if (banner) {
    await p.click('[data-alert-ack]');
    await p.waitForTimeout(3500);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector(INPUT, { timeout: 45000 });
    await p.waitForTimeout(7000);
    say(`strip after acknowledge + reload: ${(await p.locator('[data-emergency-banner]').count()) === 0 ? 'gone' : 'STILL THERE'}`);
  }

  // a second employee, and the storefront
  await p.goto(`${BASE}/admin/v2/agents/ops?agent=ops-content`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(4000);
  say(`content employee header: ${(((await p.locator('[data-chat-header]').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()).slice(0, 60)}`);
  await shot(p, '17-content-employee');

  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(7000);
  say(`storefront title: ${await p.title()}`);
  await shot(p, '18-storefront-phone');
} catch (e) {
  say(`CRASH ${e.message}`);
} finally {
  say(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 4).join(' | ') : ''}`);
  fs.writeFileSync(`${DIR}/run2.txt`, log.join('\n'));
  await b.close();
}
