/**
 * Look at the golden pre-call dossier on a phone width and report what it actually answers.
 *   node scratch/check-precall-dossier.mjs [base] [sketchId]
 *
 * Nothing in the store is linked to a customer right now (measured: 19 papers, 0 owners), so the
 * instrument links the sealed test paper through the store's own door, presses the screen the way
 * the owner does, and puts the paper back to «من غير صاحب» at the end.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const SKETCH = Number(process.argv[3] || 12);
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
let LINKED = false;
p.on('console', m => m.type()==='error' && errs.push(m.text().slice(0,90)));
p.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0,90)));

const toArabic = (s) => [...s].map(ch => /[0-9]/.test(ch) ? String.fromCharCode(0x0660 + Number(ch)) : ch).join('');

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (p.url().includes('gate/login')) {
    await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
    await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
    await p.click('button[type=submit]');
    await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
    const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,'').replace(/-/g,'').toUpperCase();
    await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding:'base32', step:30, digits:6 }));
    await p.click('button[type=submit]');
    for (let i=0;i<25 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  }
  console.log('URL', p.url());

  // 1. the roll, and what the door answers for its rows
  const probe = await p.evaluate(async () => {
    const res = await fetch('/api/admin/customers', { cache: 'no-store' });
    const data = await res.json();
    const lines = (data.customers || []).filter(c => c.phone).slice(0, 4)
      .map(c => ({ key: c.key, phone: c.phone, name: c.name }));
    const files = [];
    for (const line of lines) {
      const r = await fetch(`/api/admin/customers/dossier?customer_key=${encodeURIComponent(line.key)}`, { cache: 'no-store' });
      const j = await r.json();
      files.push({
        key: line.key, phone: line.phone, status: r.status, ok: j.success, error: j.error ?? null,
        headline: j.headline ?? null, papers: (j.papers || []).length,
        sections: (j.sections || []).map(s => `${s.id}:${s.facts.length}/${(s.swatches||[]).length}/${(s.missing||[]).length}`),
      });
    }
    return { rollCount: (data.customers || []).length, lines, files };
  });
  console.log('ROLL rows:', probe.rollCount);
  for (const f of probe.files) console.log('  DOSSIER', f.phone, f.status, '|', f.headline ?? f.error, '|', f.sections.join(' '), '| papers', f.papers);

  const chosen = probe.files.find(f => f.ok && f.phone === '1005554444') ?? probe.files.find(f => f.ok);
  if (!chosen) throw new Error('no dossier answer for any roll row');

  // 2. link the sealed test paper through the store's own door
  const linked = await p.evaluate(async ({ key, id }) => {
    const r = await fetch('/api/admin/ops/sketch', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, customer_key: key }),
    });
    return { status: r.status, body: await r.json() };
  }, { key: chosen.key, id: SKETCH });
  console.log('LINK', SKETCH, '->', chosen.key, linked.status, JSON.stringify(linked.body).slice(0, 120));
  LINKED = linked.status === 200 && linked.body?.success === true;
  if (!LINKED) throw new Error('the door refused to link the paper');

  // 3. press the screen the way the owner does
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForSelector('[data-dossier-search]', { timeout: 60000 });
  await p.fill('[data-dossier-search]', toArabic(chosen.phone.slice(-4)));
  let cands = 0;
  for (let i = 0; i < 30; i++) { cands = await p.locator('[data-dossier-pick]').count(); if (cands) break; await p.waitForTimeout(700); }
  console.log('SEARCH', toArabic(chosen.phone.slice(-4)), '-> candidates', cands);
  if (!cands) {
    console.log('PANEL TEXT', ((await p.locator('[data-dossier-panel]').innerText().catch(() => '(no panel)')) || '').replace(/\s+/g, ' ').slice(0, 400));
    const calls = await p.evaluate(async () => {
      const r = await fetch('/api/admin/customers', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      return `${r.status} rows=${(j?.customers ?? []).length} first=${JSON.stringify((j?.customers ?? [])[0]?.phone ?? null)}`;
    });
    console.log('ROLL FROM PAGE', calls);
    console.log('ERRORS SO FAR', errs.length, errs.slice(0, 4).join(' ;; '));
    await p.screenshot({ path: 'scratch/precall-noresult.png' });
    throw new Error('the picker never showed a candidate');
  }

  await p.locator('[data-dossier-pick]').first().click();
  await p.waitForSelector('[data-dossier-file]', { timeout: 60000 });
  await p.waitForTimeout(2500);

  const secs = await p.locator('[data-dossier-section]').evaluateAll(els => els.map(e => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300)));
  console.log('SECTIONS', secs.length);
  secs.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  console.log('SWATCHES', await p.locator('[data-dossier-swatches] span').count());
  console.log('MISSING lines', await p.locator('[data-dossier-missing]').count());
  const img = p.locator('[data-dossier-paper] img');
  const imgOk = await img.count() ? await img.first().evaluate(e => ({ complete: e.complete, w: e.naturalWidth })) : null;
  console.log('PAPER photo nodes', await img.count(), 'loaded', JSON.stringify(imgOk), 'sheet link', await p.locator('[data-dossier-sheet]').count());
  console.log('CALL', await p.locator('[data-dossier-call]').getAttribute('href').catch(()=>'(none)'));
  console.log('WA', await p.locator('[data-dossier-whatsapp]').getAttribute('href').catch(()=>'(none)'));
  const body = (await p.locator('[data-dossier-panel]').innerText()).replace(/\s+/g,' ');
  console.log('LATIN in panel', (body.match(/[A-Za-z]{4,}/g) || []).slice(0, 12).join(' ') || 'none');
  console.log('PROBLEM', ((await p.locator('[data-dossier-problem]').textContent().catch(()=>'')) || '').trim() || 'none');
  await p.screenshot({ path: 'scratch/precall-dossier-phone.png', fullPage: true });

  // 4. reload: the file is the store's, not a lucky render
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-dossier-search]', { timeout: 60000 });
  console.log('AFTER RELOAD panel', await p.locator('[data-dossier-panel]').count(), 'file open', await p.locator('[data-dossier-file]').count());

  // 5. the two honest refusals
  const refusals = await p.evaluate(async () => {
    const out = [];
    for (const q of ['?customer_key=phone:1099999999', '?customer_key=phone:0000000000', '']) {
      const r = await fetch(`/api/admin/customers/dossier${q}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      out.push(`${q || '(بلا مفتاح)'} → ${r.status} ${j.error ?? ''}`);
    }
    return out;
  });
  console.log('REFUSALS', refusals.join(' || '));

  // 6. put the paper back
  await unlink();
  console.log('ERRORS', errs.length, errs.slice(0, 3).join(' ;; '));
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 300));
  await unlink();
} finally {
  await b.close();
}

/** The store is left exactly as it was found: the test paper goes back to «من غير صاحب». */
async function unlink() {
  if (!LINKED) return;
  LINKED = false;
  try {
    const r = await p.evaluate(async ({ id }) => {
      const res = await fetch('/api/admin/ops/sketch', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, customer_key: null }),
      });
      return { status: res.status, body: await res.json() };
    }, { id: SKETCH });
    console.log('UNLINK', SKETCH, r.status, JSON.stringify(r.body).slice(0, 120));
  } catch (e) {
    console.log('UNLINK FAILED — the paper is still linked', String(e.message || e).slice(0, 120));
  }
}
