/**
 * How many of N presses of the analysis door come back as a profile?
 *   node scratch/count-analyze-parses.mjs [base] [n]
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const N = Number(process.argv[3] || 3);
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

  const runs = await p.evaluate(async ({ n }) => {
    const leads = await (await fetch('/api/admin/leads', { cache: 'no-store' })).json();
    const rows = leads.leads || [];
    const withChat = rows.find(l => (l.messages || []).length >= 2) ?? rows[0] ?? {};
    const body = {
      name: withChat.name ?? '', phone: withChat.phone ?? '', roomType: withChat.roomType ?? '',
      budget: withChat.budget ?? '', location: withChat.location ?? '', summary: withChat.summary ?? '',
      messages: withChat.messages ?? [], telemetry: withChat.telemetry ?? null,
    };
    const out = [];
    for (let i = 0; i < n; i++) {
      const r = await fetch('/api/admin/leads/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      out.push({ status: r.status, generated: j.generated ?? null, answered: j.answered_by ?? null, fields: Object.keys(j.profile ?? {}).length });
    }
    return { lead: `${body.name} · رسائل=${(body.messages||[]).length}`, out };
  }, { n: N });

  console.log('LEAD', runs.lead);
  runs.out.forEach((r, i) => console.log(`  ${i + 1}. ${r.status} generated=${r.generated} fields=${r.fields} | ${r.answered}`));
  const good = runs.out.filter((r) => r.generated === true).length;
  console.log(`PARSED ${good} of ${runs.out.length} from a key`);
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 200));
} finally {
  await b.close();
}
