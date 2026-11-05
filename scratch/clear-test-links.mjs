/**
 * Takes the test links off the desk: the papers this session's checks photographed stay
 * where they are (nothing is deleted), but none of them may sit attached to a real
 * customer's name after the check is finished.
 *
 * Usage: node scratch/clear-test-links.mjs https://azenith-living.vercel.app
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
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

  const cleared = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    const linked = (j.sketches || []).filter((s) => s.customer_key);
    const out = [];
    for (const row of linked) {
      const res = await fetch('/api/admin/ops/sketch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, customer_key: null }),
      });
      out.push(`${row.id}:${res.status}`);
    }
    const after = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    return { cleared: out, still_linked: (after.sketches || []).filter((s) => s.customer_key).length, rows: (after.sketches || []).length };
  });
  console.log(`CLEARED ${cleared.cleared.join(' ') || 'nothing was linked'} · still_linked=${cleared.still_linked} · rows_on_desk=${cleared.rows}`);
} catch (error) {
  console.log('FAILED', String(error.message || error).slice(0, 200));
} finally {
  await b.close();
}
