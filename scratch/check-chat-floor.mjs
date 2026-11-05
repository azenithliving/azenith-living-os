/**
 * Live check of the cockpit's answer when a model is asked for: the reply must be his
 * language, and must name what still stands — never an English machine sentence.
 *
 * Usage: node scratch/check-chat-floor.mjs https://azenith-living.vercel.app
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

  const asked = await p.evaluate(async () => {
    await fetch('/api/admin/agents/messages?agent_key=ops-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_key: 'ops-lead',
        sender_type: 'user',
        content: 'قولي جملة واحدة: إيه أكتر حاجة لسه ما اتعملتش في المتجر؟',
      }),
    });
    // The reply is written by the store's own brain; read the thread back and take his last
    // word — but only a word that arrived after this question was asked.
    const askedAt = Date.now();
    let reply = null;
    for (let i = 0; i < 12 && !reply; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const res = await fetch('/api/admin/agents/messages?agent_key=ops-lead', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const mine = rows.filter((m) => m.sender_type === 'agent' && Date.parse(m.created_at || m.timestamp || '') >= askedAt - 5000).slice(-1)[0];
      if (mine) reply = String(mine.content ?? '');
    }
    return { reply };
  });

  const latinRuns = (asked.reply.match(/[A-Za-z]{4,}(?:[ .][A-Za-z]{4,})+/g) || []).slice(0, 4);
  console.log(`HTTP ${asked.status}`);
  console.log(`REPLY :: ${String(asked.reply).replace(/\s+/g, ' ').slice(0, 260)}`);
  console.log(`ENGLISH_PROSE ${latinRuns.length ? `FOUND: ${latinRuns.join(' | ')}` : 'none'}`);
  console.log(`CONSOLE_ERRORS ${errors.length} ${errors.slice(0, 2).join(' ;; ')}`);
  await p.goto(`${BASE}/admin/v2/agents/ops?agent=ops-lead`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: 'scratch/chat-floor-live.png', fullPage: false });
} catch (error) {
  console.log('FAILED', String(error.message || error).slice(0, 250));
} finally {
  await b.close();
}
