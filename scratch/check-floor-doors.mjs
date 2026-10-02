/**
 * Do the wired sales-desk doors answer from the chain, and say who answered?
 *   node scratch/check-floor-doors.mjs [base]
 *
 * Three admin doors are pressed with a real lead row from the roll, and the public picture door
 * is pressed with a one-pixel image — the smallest honest proof that it answers, refuses without
 * a key, and never prints a provider's English reason.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on('console', m => m.type()==='error' && errs.push(m.text().slice(0,90)));

const TINY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (p.url().includes('gate/login')) {
    await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
    await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
    await p.click('button[type=submit]');
    try {
      await p.waitForSelector('input[placeholder="000000"]', { timeout: 60000 });
    } catch {
      console.log('NO 2FA SCREEN — page says:', (await p.locator('body').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0, 240));
      throw new Error('the gate never asked for the code');
    }
    const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,'').replace(/-/g,'').toUpperCase();
    await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding:'base32', step:30, digits:6 }));
    await p.click('button[type=submit]');
    for (let i=0;i<25 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  }
  console.log('URL', p.url());

  const out = await p.evaluate(async ({ tiny }) => {
    // The same row the screen's button sends: the leads door's own object, with its messages and
    // telemetry. A stripped body measures the strip, not the door.
    const leads = await (await fetch('/api/admin/leads', { cache: 'no-store' })).json();
    const rows = leads.leads || [];
    const withChat = rows.find(l => (l.messages || []).length >= 2) ?? rows[0] ?? {};
    const body = {
      name: withChat.name ?? '', phone: withChat.phone ?? '', roomType: withChat.roomType ?? '',
      budget: withChat.budget ?? '', location: withChat.location ?? '', summary: withChat.summary ?? '',
      messages: withChat.messages ?? [], telemetry: withChat.telemetry ?? null,
    };
    const post = async (url, payload) => {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      return { url, status: r.status, answered_by: j.answered_by ?? null, note: j.note ?? null, error: j.error ?? null, generated: j.generated ?? null, fields: Object.keys(j.profile ?? {}).length };
    };
    return {
      lead: `${body.name} · ${body.phone} · رسائل=${body.messages.length}`,
      analyze: await post('/api/admin/leads/analyze', body),
      suggestions: await post('/api/admin/leads/suggestions', body),
      followUp: await post('/api/admin/leads/follow-up', body),
      vision: await post('/api/ai/analyze-vision', { prompt: 'صف ما في الصورة في سطر واحد', imageUrl: tiny }),
      visionNoImage: await post('/api/ai/analyze-vision', { prompt: 'صف', imageUrl: 'https://example.com/a.jpg' }),
    };
  }, { tiny: TINY });

  console.log('LEAD', out.lead);
  for (const key of ['analyze', 'suggestions', 'followUp', 'vision', 'visionNoImage']) {
    const r = out[key];
    console.log(`${key.padEnd(14)} ${r.status} | answered: ${r.answered_by ?? '—'} | fields: ${r.fields ?? 0} | note: ${r.note ?? '—'} | error: ${r.error ?? '—'}`);
  }
  console.log('ERRORS', errs.length, errs.slice(0, 2).join(' ;; '));
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 300));
} finally {
  await b.close();
}
