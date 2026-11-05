/**
 * Which of the two is it: no key answered, or a key answered with something unusable?
 *   node scratch/why-json-doors-fall.mjs [base]
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (p.url().includes('gate/login')) {
    await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
    await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
    await p.click('button[type=submit]');
    await p.waitForSelector('input[placeholder="000000"]', { timeout: 60000 });
    const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,'').replace(/-/g,'').toUpperCase();
    await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding:'base32', step:30, digits:6 }));
    await p.click('button[type=submit]');
    for (let i=0;i<25 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  }

  const out = await p.evaluate(async () => {
    const roll = await (await fetch('/api/admin/customers', { cache: 'no-store' })).json();
    const lead = (roll.customers || []).find(c => c.phone) ?? {};
    const body = { name: lead.name ?? '', phone: lead.phone ?? '', roomType: '', budget: '', summary: '', messages: [], telemetry: null };
    const a = await (await fetch('/api/admin/leads/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    const s = await (await fetch('/api/admin/leads/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    return {
      analyze: { answered: a.answered_by, generated: a.generated, note: a.profile?.note ?? null, keys: Object.keys(a.profile ?? {}) },
      suggestions: { answered: s.answered_by, note: s.note ?? null, first: (s.suggestions ?? [])[0] ?? null },
    };
  });
  console.log('ANALYZE   ', JSON.stringify(out.analyze));
  console.log('SUGGEST   ', JSON.stringify(out.suggestions));
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 200));
} finally {
  await b.close();
}
