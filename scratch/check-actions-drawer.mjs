/**
 * Live check: the actions drawer inside the cockpit chat, on a phone screen.
 * Asserts the drawer opens over the thread, carries the real tiles, closes on the
 * scrim, and that the header still fits a 390px screen with the new button.
 * No tile is pressed: they run real tools.
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

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 110)));

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 30000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 12 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
  console.log(`LOGIN ${p.url().includes('/admin') ? 'ok' : 'FAILED'}`);

  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 40000 });
  await p.waitForTimeout(3000);

  const header = await p.evaluate(() => {
    const h = document.querySelector('[data-chat-header]');
    if (!h) return 'no header';
    return h.scrollWidth > h.clientWidth + 1 ? `OVERFLOW ${h.scrollWidth}>${h.clientWidth}` : `fits (${h.scrollWidth}/${h.clientWidth})`;
  });
  console.log(`HEADER ${header}`);

  // The panel is always mounted (so the transition runs); "closed" means pushed off
  // the left edge, which a bounding box shows and an visibility check does not.
  const drawerState = async () => {
    const box = await p.locator('[data-actions-drawer]').boundingBox().catch(() => null);
    return box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : 'absent';
  };

  console.log(`CLOSED BY DEFAULT ${await drawerState()}`);

  await p.click('[data-actions-toggle]');
  await p.waitForTimeout(700);
  const drawer = p.locator('[data-actions-drawer]');
  const open = (await drawer.count()) > 0;
  const tiles = await drawer.locator('button, a').count();
  const text = open ? ((await drawer.textContent()) || '').replace(/\s+/g, ' ').trim() : '';
  console.log(`DRAWER open=${open} interactive=${tiles} ${await drawerState()} :: ${text.slice(0, 110)}`);
  const latin = text.match(/[A-Za-z_]{4,}/g) || [];
  console.log(`DRAWER_LATIN ${latin.length === 0 ? 'none' : latin.slice(0, 8).join(', ')}`);
  await p.screenshot({ path: 'scratch/actions-drawer-phone.png' });

  // The scrim is only the strip the drawer leaves uncovered — 88% of the width is the
  // drawer itself, so a centre click would hit the panel, not the scrim.
  await p.mouse.click(372, 420);
  await p.waitForTimeout(700);
  console.log(`CLOSED ON SCRIM ${await drawerState()}`);

  await p.click('[data-actions-toggle]');
  await p.waitForTimeout(700);
  await p.locator('[data-actions-drawer] button').first().click();
  await p.waitForTimeout(700);
  console.log(`CLOSED ON CLOSE BUTTON ${await drawerState()}`);
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 2).join(' | ') : ''}`);
  await b.close();
}
