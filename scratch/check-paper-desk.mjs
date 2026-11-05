/**
 * Live check of the paper desk: draws a sketch-like image, uploads it through the
 * owner's own page, and reads back what the store says it saw.
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

const svg = `<svg width="900" height="620" xmlns="http://www.w3.org/2000/svg">
  <rect width="900" height="620" fill="#f7f4ec"/>
  <rect x="120" y="120" width="640" height="360" fill="none" stroke="#222" stroke-width="6"/>
  <text x="440" y="100" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">4.50</text>
  <text x="300" y="530" font-family="Arial" font-size="46" text-anchor="middle" fill="#111">3.20</text>
</svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 110)));

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

  await p.goto(`${BASE}/admin/v2/sketches`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(4000);
  console.log(`PAGE title=${((await p.locator('h1').first().textContent().catch(() => '')) || '').trim()}`);

  await p.setInputFiles('input[type=file]', { name: 'room.png', mimeType: 'image/png', buffer: png });

  let result = '';
  for (let i = 0; i < 60 && !result; i++) {
    await p.waitForTimeout(5000);
    const stage = ((await p.locator('div p').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (i % 4 === 0) console.log(`  t=${i * 5}s stage=${stage.slice(0, 60)}`);
    const sections = await p.locator('section').allTextContents();
    const hit = sections.map((t) => t.replace(/\s+/g, ' ').trim()).find((t) => t.includes('مؤكدة'));
    if (hit) result = hit;
  }
  console.log(`READING :: ${result.slice(0, 260)}`);
  await p.screenshot({ path: 'scratch/paper-desk-reading.png', fullPage: true });

  const latin = (result.match(/[A-Za-z_]{4,}/g) || []).filter((w) => !/http|png|jpg/.test(w));
  console.log(`LATIN_ON_PAGE ${latin.length === 0 ? 'none' : [...new Set(latin)].slice(0, 6).join(', ')}`);

  const listed = await p.locator('li').count();
  console.log(`LIST rows=${listed}`);
} catch (e) {
  console.log(`CRASH ${e.message}`);
} finally {
  console.log(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 3).join(' | ') : ''}`);
  await b.close();
}
