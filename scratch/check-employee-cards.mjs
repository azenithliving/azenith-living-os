/**
 * Live check: the command canvas at phone width.
 * Counts the employee cards, proves each door opens a working chat, screenshots it.
 * Secrets are read from .env.local and never printed.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3111';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const out = [];
const say = (line) => {
  out.push(line);
  console.log(line);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));

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
  say(`LOGIN ${p.url().includes('/admin') ? 'ok' : 'FAILED'} at ${BASE}`);

  await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(14000);

  const cards = await p.locator('[data-employee-card]').evaluateAll((els) =>
    els.map((e) => ({
      key: e.getAttribute('data-employee-card'),
      href: e.getAttribute('href'),
      text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
    }))
  );
  say(`CARDS ${cards.length}`);
  for (const c of cards) say(`  ${c.key} -> ${c.href} :: ${c.text.slice(0, 60)}`);

  const latinInArabic = cards
    .filter((c) => /[A-Za-z]{3,}/.test(c.text))
    .map((c) => c.key);
  say(`ARABIC_ONLY ${latinInArabic.length === 0 ? 'ok' : `mixed on: ${latinInArabic.join(', ')}`}`);

  await p.screenshot({ path: 'scratch/employee-cards-phone.png', fullPage: true });
  say('SHOT scratch/employee-cards-phone.png');

  // Every door must open a chat that is really that employee's, not the leader's.
  for (const key of ['ops-qa', 'ops-dev']) {
    await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.click(`[data-employee-card="${key}"]`);
    let opened = false;
    for (let i = 0; i < 15 && !opened; i++) {
      opened = (await p.locator('input[placeholder*="لهجتك"], textarea').count()) > 0;
      if (!opened) await p.waitForTimeout(1500);
    }
    const header = opened
      ? await p.locator('[data-chat-header]').first().textContent().catch(() => '')
      : '';
    say(`DOOR ${key} ${opened ? 'opens a chat' : 'DEAD'} at ${p.url()} header=${(header || '').replace(/\s+/g, ' ').slice(0, 50)}`);
  }

  // The sales manager lives in his own house.
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3000);
  const salesChat = (await p.locator('input[placeholder*="لهجتك"], textarea').count()) > 0;
  say(`DOOR vanguard ${salesChat ? 'opens a chat' : 'DEAD'} at ${p.url()}`);

  say(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 3).join(' | ') : ''}`);
  fs.writeFileSync('scratch/employee-cards-result.txt', out.join('\n'));
} catch (e) {
  say(`CRASH ${e.message}`);
  fs.writeFileSync('scratch/employee-cards-result.txt', out.join('\n'));
} finally {
  await b.close();
}
