/**
 * End-to-end on the published site: record a reading, open the customer's private
 * sheet, confirm his numbers on it, and look at what the sheet says afterwards.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import sharp from 'sharp';
import fs from 'fs';

const BASE = process.argv[2] ?? 'https://azenith-living.vercel.app';
const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

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

const sheetText = async () =>
  (((await p.locator('main').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim());

try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 30000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 15 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
  console.log(`LOGIN ${p.url().includes('/admin') ? 'ok' : 'FAILED'}`);

  const made = await p.evaluate(
    async ([b64]) => {
      const r = await fetch('/api/admin/ops/sketch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: `data:image/png;base64,${b64}`,
          // No `offline_reading` here, and that is deliberate. This instrument used to hand
          // the door a finished pixel reading containing the very numbers the test then
          // expected — four readings were stored with a witness that never ran, and the
          // check proved nothing. A witness now comes from the store, or not at all.
        }),
      });
      return { status: r.status, body: await r.json() };
    },
    [png.toString('base64')]
  );
  const ok = made.body?.reading?.ok;
  console.log(`RECORD http=${made.status} ok=${ok} area=${made.body?.reading?.areaSqm} path=${made.body?.passport_path}`);
  const path = made.body?.passport_path;
  if (!path) throw new Error('no passport path returned: ' + JSON.stringify(made.body).slice(0, 200));

  // the customer's side: no admin session needed, but the same phone
  await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(6000);
  console.log(`SHEET :: ${(await sheetText()).slice(0, 150)}`);
  const pics = await p.locator('main img[alt="فكرة تصميم"]').count();
  const share = await p.locator('a[href^="https://wa.me/"]').count();
  const shareHref = ((await p.locator('a[href^="https://wa.me/"]').first().getAttribute("href").catch(() => "")) || "");
  console.log(`PICS on sheet = ${pics} · whatsapp link = ${share} · href = ${shareHref.slice(0, 120)}`);
  await p.screenshot({ path: 'scratch/passport-open.png', fullPage: true });

  // a wrong number first, to see the disagreement path
  const boxes = p.locator('input[inputmode="decimal"]');
  await boxes.nth(0).fill('9.99');
  await boxes.nth(1).fill('8.88');
  await p.locator('button:has-text("أكّد مقاساتي")').click();
  await p.waitForTimeout(6000);
  console.log(`MISMATCH :: ${(await sheetText()).slice(-160)}`);
  await p.screenshot({ path: 'scratch/passport-mismatch.png', fullPage: true });

  // then his real numbers
  await boxes.nth(0).fill('4.50');
  await boxes.nth(1).fill('3.20');
  await p.locator('button:has-text("أكّد مقاساتي")').click();
  await p.waitForTimeout(7000);
  console.log(`CONFIRMED :: ${(await sheetText()).slice(-190)}`);
  await p.screenshot({ path: 'scratch/passport-confirmed.png', fullPage: true });

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  const after = await sheetText();
  console.log(`AFTER RELOAD sealed=${after.includes('مختومة')} shows-his-numbers=${after.includes('٤٫٥') || after.includes('4.5')}`);
  await p.screenshot({ path: 'scratch/passport-after-reload.png', fullPage: true });
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await b.close();
}
