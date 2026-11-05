/**
 * Live check: the customer number on the old landing screen must be the same number
 * the sales office's roll answers with — and the old work centre must carry a door to
 * the moved employee. Reads both from the running app, never from the source.
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

async function login() {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 30000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 12 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
}

try {
  await login();
  console.log(`LOGIN ${p.url().includes('/admin') ? 'ok' : 'FAILED'}`);

  // The roll, asked directly.
  const roll = await p.evaluate(async () => {
    const r = await fetch('/api/admin/customers');
    const j = await r.json();
    return { status: r.status, totals: j?.totals ?? null };
  });
  console.log(`ROLL status=${roll.status} customers=${roll.totals?.customers ?? '(no answer)'}`);

  await p.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(9000);
  const card = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('*')].filter(
      (e) => e.children.length === 0 && (e.textContent || '').trim() === 'العملاء'
    );
    for (const n of nodes) {
      const box = n.closest('div,a');
      const t = (box?.parentElement?.textContent || box?.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) return t.slice(0, 90);
    }
    return '(card not found)';
  });
  console.log(`LANDING CARD :: ${card}`);

  await p.goto(`${BASE}/admin/work`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  const doors = await p.locator('a[href="/admin/v2/sales"]').count();
  const deadLabel = await p.locator('text=متابعة العملاء').count();
  console.log(`WORK DOOR to the moved office=${doors} old promise left behind=${deadLabel}`);
  await p.screenshot({ path: 'scratch/work-doors-phone.png', fullPage: true });
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  await b.close();
}
