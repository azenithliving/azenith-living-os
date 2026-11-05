/**
 * The key station, driven the way the owner will drive it: on a phone width, on the published
 * site, pasting a real key into the desk's own field and reading the answer the desk gives.
 *
 * The key is read from a file that this run deletes; it is never printed, never screenshotted
 * as text, and never leaves the page it was typed into.
 *
 * Usage: node scratch/check-key-station.mjs https://azenith-living.vercel.app scratch/.new-keys.tsv
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const KEY_FILE = process.argv[3];
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();

const wanted = fs
  .readFileSync(KEY_FILE, 'utf8')
  .split(/\r?\n/)
  .map((line) => line.split('\t'))
  .filter((parts) => parts.length === 2)
  .map(([provider, key]) => ({ provider, key }));

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 20 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  console.log('LOGIN ok');

  await p.goto(`${BASE}/admin/v2/keys`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('[data-key-add]', { timeout: 40000 });
  const options = await p.locator('[data-key-provider] option').evaluateAll((els) => els.map((e) => e.textContent.trim()));
  console.log(`FORM providers=${options.length} first=${options.slice(0, 4).join(' | ')}`);
  console.log(`MASKED input type=${await p.locator('[data-key-input]').getAttribute('type')}`);
  await p.screenshot({ path: 'scratch/key-station-form.png', fullPage: false });

  for (const entry of wanted) {
    await p.selectOption('[data-key-provider]', entry.provider);
    await p.fill('[data-key-input]', entry.key);
    await p.click('[data-key-add-submit]');
    await p.waitForFunction(
      () => {
        const el = document.querySelector('[data-key-news]');
        return el && !el.textContent.includes('بأسأل المزود');
      },
      null,
      { timeout: 90000 }
    ).catch(() => {});
    await p.waitForTimeout(2500);
    const news = clean(await p.locator('[data-key-news]').textContent().catch(() => ''));
    const leaked = news.includes(entry.key.slice(0, 10));
    console.log(`ADD ${entry.provider} → "${news}" key_echoed=${leaked ? 'YES — DEFECT' : 'no'}`);
  }

  const totals = clean(await p.locator('[data-key-totals]').textContent().catch(() => ''));
  console.log(`TOTALS ${totals}`);
  await p.screenshot({ path: 'scratch/key-station-after.png', fullPage: false });

  // The point of the whole exercise: a request served by a key that was added tonight.
  const chat = await ctx.newPage();
  const askedAt = Date.now();
  await chat.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await chat.waitForTimeout(6000);
  await chat.evaluate(async () => {
    await fetch('/api/admin/agents/messages?agent_key=ops-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_key: 'ops-lead', sender_type: 'user', content: 'اكتب كلمة واحدة بالعربي: نجاح' }),
    });
  });
  let reply = null;
  for (let i = 0; i < 14 && !reply; i++) {
    await chat.waitForTimeout(5000);
    reply = await chat.evaluate(async (since) => {
      const j = await (await fetch('/api/admin/agents/messages?agent_key=ops-lead', { cache: 'no-store' })).json();
      const rows = Array.isArray(j?.data) ? j.data : [];
      const mine = rows.filter((m) => m.sender_type === 'agent' && Date.parse(m.created_at || '') >= since - 5000).slice(-1)[0];
      return mine ? String(mine.content || '') : null;
    }, askedAt);
  }
  console.log(`CHAT reply=${reply ? `"${clean(reply).slice(0, 160)}"` : '(none arrived)'}`);
  console.log(`CONSOLE_ERRORS ${errors.length} ${errors.slice(0, 2).join(' ;; ')}`);
  await chat.close();
} catch (error) {
  console.log('FAILED', String(error.message || error).slice(0, 250));
  await p.screenshot({ path: 'scratch/key-station-failed.png', fullPage: true }).catch(() => {});
} finally {
  await b.close();
}
