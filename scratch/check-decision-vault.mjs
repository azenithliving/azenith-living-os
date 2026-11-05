/**
 * Live check: the decisions vault inside the full-screen chat, on a phone screen.
 * Proves the button exists, the badge carries the real queue length, the panel opens,
 * and nothing on it is a machine identifier.
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

  const queue = await p.evaluate(async () => {
    const r = await fetch('/api/admin/agents/approval-queue');
    const j = await r.json();
    return { status: r.status, n: Array.isArray(j?.approvals) ? j.approvals.length : -1 };
  });
  console.log(`QUEUE status=${queue.status} pending=${queue.n}`);

  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 40000 });
  await p.waitForTimeout(4000);

  const btn = p.locator('[data-decisions-toggle]').first();
  console.log(`BUTTON present=${(await btn.count()) > 0}`);
  const badge = await p
    .locator('[data-decisions-count]')
    .first()
    .textContent()
    .catch(() => null);
  console.log(`BADGE text=${badge ?? '(none while the queue is empty)'}`);

  await btn.click();
  await p.waitForTimeout(1500);
  const vault = p.locator('[data-decision-vault]');
  const visible = (await vault.count()) > 0 && (await vault.first().isVisible());
  const text = visible ? ((await vault.first().textContent()) || '').replace(/\s+/g, ' ').trim() : '';
  console.log(`VAULT visible=${visible} :: ${text.slice(0, 90)}`);
  const latin = text.match(/[A-Za-z_]{4,}/g) || [];
  console.log(`VAULT_LATIN ${latin.length === 0 ? 'none' : latin.slice(0, 6).join(', ')}`);
  await p.screenshot({ path: 'scratch/decision-vault-phone.png' });
  console.log('SHOT scratch/decision-vault-phone.png');

  const headerOverflow = await p.evaluate(() => {
    const h = document.querySelector('[data-chat-header]');
    if (!h) return 'no header';
    return h.scrollWidth > h.clientWidth + 1 ? `OVERFLOW ${h.scrollWidth}>${h.clientWidth}` : 'fits';
  });
  console.log(`HEADER ${headerOverflow}`);
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 2).join(' | ') : ''}`);
  await b.close();
}
