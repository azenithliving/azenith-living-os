/**
 * Live check: the sidebar's two doors on a phone, and the deep link that opens the
 * decision vault together with the conversation.
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
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));

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

  await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(6000);
  await p.locator('button.lg\\:hidden').first().click();
  await p.waitForTimeout(1500);

  const queue = await p.evaluate(async () => {
    const r = await fetch('/api/admin/agents/approval-queue');
    const j = await r.json();
    return Array.isArray(j?.approvals) ? j.approvals.length : -1;
  });
  const badge = ((await p.locator('a[href*="decisions=1"] span').last().textContent().catch(() => '')) || '').trim();
  const stopLabel = ((await p.locator('button:has-text("إيقاف فوري")').count()) > 0) ? 'present' : 'MISSING';
  console.log(`SIDEBAR queue=${queue} badgeOnDoor=${badge || '(none)'} stopButton=${stopLabel}`);
  await p.screenshot({ path: 'scratch/sidebar-doors-phone.png', fullPage: false });

  await p.click('a[href*="decisions=1"]');
  let opened = false;
  for (let i = 0; i < 20 && !opened; i++) {
    await p.waitForTimeout(1500);
    opened = (await p.locator('[data-decision-vault]:visible').count()) > 0;
  }
  const vaultText = ((await p.locator('[data-decision-vault]').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  console.log(`DEEP LINK url=${p.url()} vaultOpen=${opened} :: ${vaultText.slice(0, 70)}`);
  await p.screenshot({ path: 'scratch/sidebar-decisions-opened.png' });
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await b.close();
}
