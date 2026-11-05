/**
 * Live check: the red emergency strip, end to end.
 * Fires a real event through the door the swarm already publishes to, reads it back
 * through the alerts door, sees it on the cockpit at phone width, acknowledges it,
 * and proves it stays gone after a reload.
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

const bannerText = async () => {
  const el = p.locator('[data-emergency-banner]');
  if (!(await el.count())) return '(absent)';
  return ((await el.first().textContent()) || '').replace(/\s+/g, ' ').trim();
};

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

  const before = await p.evaluate(async () => {
    const r = await fetch('/api/admin/agents/alerts');
    return r.json();
  });
  console.log(`BEFORE count=${before.count} alert=${before.alert ? before.alert.label : 'none'}`);

  // Fire through the door the swarm already uses — no test-only path.
  const fired = await p.evaluate(async () => {
    const r = await fetch('/api/admin/ops?action=sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subaction: 'publish',
        event_type: 'identity_violation',
        source_agent: 'OPS-LEAD',
        target_agents: [],
        payload: { summary: 'قياس حيّ للشريط الأحمر' },
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  console.log(`FIRED http=${fired.status} id=${fired.body?.event_id ?? JSON.stringify(fired.body).slice(0, 60)}`);

  const after = await p.evaluate(async () => {
    const r = await fetch('/api/admin/agents/alerts');
    return r.json();
  });
  console.log(`AFTER count=${after.count} label=${after.alert?.label} who=${after.alert?.who} note=${after.alert?.note}`);
  const latin = [after.alert?.label, after.alert?.who, after.alert?.note].filter(Boolean).join(' ').match(/[A-Za-z_]{4,}/g) || [];
  console.log(`ALERT_LATIN ${latin.length === 0 ? 'none' : latin.join(', ')}`);

  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 40000 });
  await p.waitForTimeout(3000);
  console.log(`BANNER :: ${(await bannerText()).slice(0, 100)}`);
  await p.screenshot({ path: 'scratch/emergency-banner-phone.png' });

  await p.click('[data-alert-ack]');
  await p.waitForTimeout(2500);
  console.log(`AFTER ACK :: ${(await bannerText()).slice(0, 80)}`);

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 40000 });
  await p.waitForTimeout(3000);
  console.log(`AFTER RELOAD :: ${(await bannerText()).slice(0, 80)}`);
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 2).join(' | ') : ''}`);
  await b.close();
}
