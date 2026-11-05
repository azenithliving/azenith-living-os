/**
 * Live check of «whose paper is this?» at 390 px, the owner's own press path:
 * link a paper from the desk, let a customer hand over his own number on his sheet,
 * then read both back after a reload and put the store's ledger back the way it was.
 *
 * Usage: node scratch/check-sketch-owner.mjs http://localhost:3223
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

const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const last4 = (phone) => (phone ? `…${String(phone).slice(-4)}` : '—');

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
p.on('pageerror', (e) => errors.push(`pageerror ${String(e.message).slice(0, 120)}`));

const login = async () => {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 20 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  if (!p.url().includes('/admin')) throw new Error('login failed');
};

try {
  await login();
  console.log('LOGIN ok');

  // one customer from the roll who actually carries a mobile
  const chosen = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/customers', { cache: 'no-store' })).json();
    const withPhone = (j.customers || []).filter((c) => c.phone);
    return withPhone.length ? { key: withPhone[0].key, name: withPhone[0].name, phone: withPhone[0].phone } : null;
  });
  if (!chosen) throw new Error('the roll holds no customer with a mobile — nothing to link to');
  console.log(`ROLL customer=${chosen.name || '(no name)'} phone=${last4(chosen.phone)}`);

  await p.goto(`${BASE}/admin/v2/sketches`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(5000);
  const rows = p.locator('[data-sketch-link]');
  console.log(`DESK link buttons=${await rows.count()} owner chips=${await p.locator('[data-sketch-owner]').count()}`);

  // A. the owner's own press: pick from the roll
  const deskId = await rows.first().getAttribute('data-sketch-link');
  await rows.first().click();
  await p.waitForSelector('[data-sketch-picker]', { timeout: 15000 });
  const beforeSearch = await p.locator('[data-sketch-picker] li').count();
  // Typed in HIS numerals (٠١٢٣٤٥٦٧٨٩), because that is the keyboard he owns.
  const tail = String(chosen.phone).slice(-4).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  await p.fill('[data-sketch-picker] input', tail);
  await p.waitForTimeout(900);
  const candidates = await p.locator('[data-sketch-picker] li button').allTextContents();
  console.log(`PICKER typed=${tail} candidates_before=${beforeSearch} after=${candidates.length} first=${clean(candidates[0])}`);
  await p.locator('[data-sketch-picker] li button').first().click();
  await p.waitForTimeout(2500);
  const chip = clean(await p.locator(`[data-sketch-owner="${deskId}"]`).textContent().catch(() => ''));
  console.log(`LINKED row=${deskId} chip="${chip}"`);
  await p.screenshot({ path: 'scratch/sketch-owner-linked.png', fullPage: true });

  // B. the customer's own hand: his mobile on his sheet, on an unlinked unconfirmed row
  const target = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    const free = (j.sketches || []).filter((s) => !s.customer_key && !s.confirmed_at && s.token );
    return free.length ? { id: free[0].id, token: free[0].token, dims: (free[0].dimensions || []).map((d) => d.meters) } : null;
  });
  if (target) {
    const sheet = await ctx.newPage();
    const sheetErrors = [];
    sheet.on('console', (m) => m.type() === 'error' && sheetErrors.push(m.text().slice(0, 120)));
    await sheet.goto(`${BASE}/passport/${target.token}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sheet.waitForTimeout(4000);
    const dial = String(chosen.phone).startsWith('0') ? String(chosen.phone) : `0${chosen.phone}`;
    await sheet.fill('input[inputmode="tel"]', dial);
    await sheet.fill('input[inputmode="decimal"] >> nth=0', String(target.dims[0] ?? 4));
    await sheet.click('button:has-text("أكّد مقاساتي")');
    await sheet.waitForTimeout(6000);
    const news = clean(await sheet.locator('section p').last().textContent().catch(() => ''));
    console.log(`SHEET row=${target.id} typed_phone=yes news="${news.slice(0, 90)}" errors=${sheetErrors.length}`);
    await sheet.screenshot({ path: 'scratch/sketch-owner-sheet.png', fullPage: true });
    await sheet.close();
  } else {
    console.log('SHEET no unlinked unconfirmed row to test with');
  }

  // C. reload: both links must be the store's, not the screen's
  await p.goto(`${BASE}/admin/v2/sketches`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(5000);
  const afterReload = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    return (j.sketches || []).filter((s) => s.customer_key).map((s) => ({ id: s.id, key: s.customer_key }));
  });
  console.log(`AFTER RELOAD linked_rows=${afterReload.length} keys=${afterReload.map((r) => `${r.id}:${r.key.replace(/\d{4}$/, '…')}`).join(' ')}`);
  const chips = await p.locator('[data-sketch-owner]').allTextContents();
  console.log(`CHIPS ${chips.map(clean).filter(Boolean).join(' | ')}`);

  // D. «his number just called» — one customer's papers only
  const filterButton = p.locator('[data-sketch-only]').first();
  const filterKey = await filterButton.getAttribute('data-sketch-only').catch(() => null);
  if (filterKey) {
    await filterButton.click();
    await p.waitForTimeout(3000);
    const filtered = await p.evaluate(
      async (key) => {
        const j = await (await fetch(`/api/admin/ops/sketch?customer_key=${encodeURIComponent(key)}`, { cache: 'no-store' })).json();
        return { rows: (j.sketches || []).length, allMatch: (j.sketches || []).every((s) => s.customer_key === key) };
      },
      filterKey
    );
    console.log(
      `FILTER heading="${clean(await p.locator('section h2').last().textContent())}" on_screen=${await p
        .locator('[data-sketch-link]')
        .count()} door_rows=${filtered.rows} all_same_customer=${filtered.allMatch}`
    );
    await p.screenshot({ path: 'scratch/sketch-owner-filter.png', fullPage: true });
    const back = p.locator('button:has-text("كل الورق")').first();
    if (await back.count()) {
      await back.click();
      await p.waitForTimeout(3000);
      console.log(`UNFILTERED rows=${await p.locator('[data-sketch-link]').count()}`);
    }
  } else {
    console.log('FILTER no per-customer button found');
  }

  // E. put the ledger back: unlink everything this check touched
  for (const id of [deskId, target && String(target.id)].filter(Boolean)) {
    const btn = p.locator(`[data-sketch-link="${id}"]`);
    if (!(await btn.count())) continue;
    await btn.click();
    await p.waitForTimeout(800);
    await p.locator(`[data-sketch-picker="${id}"] button:has-text("شيل الاسم")`).click();
    await p.waitForTimeout(2500);
    console.log(`UNLINK row=${id} chip="${clean(await p.locator(`[data-sketch-owner="${id}"]`).textContent().catch(() => ''))}"`);
  }
  console.log(`CONSOLE_ERRORS ${errors.length} ${errors.slice(0, 3).join(' ;; ')}`);
} catch (error) {
  console.log('FAILED', String(error.message || error).slice(0, 300));
  await p.screenshot({ path: 'scratch/sketch-owner-failed.png', fullPage: true }).catch(() => {});
} finally {
  await b.close();
}
