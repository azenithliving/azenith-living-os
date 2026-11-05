/**
 * Does a customer's own sheet accuse him of changing it the second he signs?
 *
 * Reproduces the live case measured 2026-10-01: a paper carrying two numbers, one of them
 * confirmed by the customer, the other left unagreed. After his press the sheet must show
 * «مختومة ومفيش حاجة اتغيرت بعدها» — not the changed-after-approval warning.
 *
 * Usage: node scratch/check-seal-honest.mjs http://localhost:3222
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import sharp from 'sharp';
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

const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">4.50</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.20</text>
</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 90)));

const started = Date.now();
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

  await p.goto(`${BASE}/admin/v2/sketches`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(4000);
  await p.setInputFiles('input[type=file]', { name: 'room.png', mimeType: 'image/png', buffer: png });
  const posted = await p
    .waitForResponse((r) => r.url().endsWith('/api/admin/ops/sketch') && r.request().method() === 'POST', { timeout: 180000 })
    .catch(() => null);
  console.log(`POST /sketch http=${posted ? posted.status() : 'no response'}`);
  const newest = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    const row = (j.sketches || [])[0];
    return row ? { id: row.id, token: row.token, dims: (row.dimensions || []).map((d) => ({ meters: d.meters, confirmed: d.confirmed })) } : null;
  });
  console.log(`UPLOADED in ${Math.round((Date.now() - started) / 1000)}s row=${newest?.id} dims=${JSON.stringify(newest?.dims)}`);
  if (!newest?.token) throw new Error('the new reading has no sheet address');

  const customer = await p.evaluate(async () => {
    const j = await (await fetch('/api/admin/customers', { cache: 'no-store' })).json();
    const withPhone = (j.customers || []).filter((c) => c.phone);
    return withPhone.length ? { key: withPhone[0].key, name: withPhone[0].name, phone: withPhone[0].phone } : null;
  });
  const dial = customer ? (String(customer.phone).startsWith('0') ? String(customer.phone) : `0${customer.phone}`) : '';
  console.log(`ROLL customer=${customer?.name || '(none)'} phone=…${String(customer?.phone || '').slice(-4)}`);

  const sheet = await ctx.newPage();
  await sheet.goto(`${BASE}/passport/${newest.token}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sheet.waitForTimeout(4000);
  const half = newest.dims[0]?.meters;
  if (!half) throw new Error('the sheet shows no numbers to type');
  if (dial) await sheet.fill('input[inputmode="tel"]', dial);
  await sheet.fill('input[inputmode="decimal"] >> nth=0', String(half));
  await sheet.click('button:has-text("أكّد مقاساتي")');
  await sheet.waitForTimeout(7000);
  const read = async () => clean(await sheet.locator('main').innerText());
  const sealedPanel = await read();
  console.log(`AFTER SIGN (1 of ${newest.dims.length} numbers${dial ? ', his own mobile typed' : ''}) :: ${sealedPanel.slice(0, 200)}`);
  await sheet.screenshot({ path: 'scratch/seal-honest-sheet.png', fullPage: true });

  await sheet.reload({ waitUntil: 'domcontentloaded' });
  await sheet.waitForTimeout(4000);
  const afterReload = await read();
  const accused = afterReload.includes('اتغيرت بعد اعتمادك');
  const calm = afterReload.includes('مختومة ومفيش حاجة اتغيرت بعدها');
  console.log(`AFTER RELOAD sealed_calm=${calm} accused=${accused}`);
  console.log(`VERDICT accused_of_changing=${accused ? 'YES — the seal is still one-sided' : 'no'}`);
  await sheet.screenshot({ path: 'scratch/seal-honest-reloaded.png', fullPage: true });
  await sheet.close();

  // did the digits he typed land on the roll, and does the desk say his name?
  await p.goto(`${BASE}/admin/v2/sketches`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(5000);
  const claimed = await p.evaluate(async (id) => {
    const j = await (await fetch('/api/admin/ops/sketch', { cache: 'no-store' })).json();
    const row = (j.sketches || []).find((s) => s.id === id);
    return row ? { key: row.customer_key, confirmed: Boolean(row.confirmed_at) } : null;
  }, newest.id);
  const chip = clean(await p.locator(`[data-sketch-owner="${newest.id}"]`).textContent().catch(() => ''));
  console.log(`CLAIMED row=${newest.id} key=${claimed?.key ? claimed.key.replace(/\d{4}$/, '…') : 'none'} confirmed=${claimed?.confirmed} chip="${chip}"`);
  await p.screenshot({ path: 'scratch/seal-honest-desk.png', fullPage: true });

  // leave the desk as it was: this paper was drawn by the check, not brought in by a customer
  if (claimed?.key) {
    await p.click(`[data-sketch-link="${newest.id}"]`);
    await p.waitForTimeout(900);
    await p.locator(`[data-sketch-picker="${newest.id}"] button:has-text("شيل الاسم")`).click();
    await p.waitForTimeout(3000);
    console.log(`UNLINKED chip="${clean(await p.locator(`[data-sketch-owner="${newest.id}"]`).textContent().catch(() => ''))}"`);
  }
  console.log(`DESK rows_now=${await p.locator('[data-sketch-link]').count()} console_errors=${errors.length} ${errors.slice(0, 2).join(' ;; ')}`);
} catch (error) {
  console.log('FAILED', String(error.message || error).slice(0, 300));
  await p.screenshot({ path: 'scratch/seal-honest-failed.png', fullPage: true }).catch(() => {});
} finally {
  await b.close();
}
