/** Look at the key desk on his phone width and report what it actually shows. */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';
const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on('console', m => m.type()==='error' && errs.push(m.text().slice(0,90)));
try {
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,'').replace(/-/g,'').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding:'base32', step:30, digits:6 }));
  await p.click('button[type=submit]');
  for (let i=0;i<20 && !p.url().includes('/admin'); i++) await p.waitForTimeout(1500);
  await p.goto(`${BASE}/admin/v2/keys`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(7000);
  const text = (await p.locator('main').innerText().catch(()=> '')) || (await p.locator('body').innerText());
  const clean = text.replace(/\s+/g,' ');
  console.log('TITLE', clean.slice(0, 120));
  console.log('CARDS', await p.locator('article, [class*=rounded-2xl]').count(), 'BUTTONS', await p.locator('button').count());
  console.log('TOTALS', (await p.locator('[data-key-totals]').textContent().catch(()=> '(none)') || '').replace(/s+/g,' ').trim());
  console.log('ADD_FORM providers', await p.locator('[data-key-provider] option').count());
  const cards = await p.locator('[data-key-provider] option').evaluateAll(e=>e.map(x=>x.textContent.trim()));
  console.log('NAMES', cards.join(' | '));
  console.log('LATIN_WORDS', (clean.match(/[A-Za-z]{5,}/g)||[]).slice(0,8).join(' ')||'none');
  console.log('ERRORS', errs.length, errs.slice(0,2).join(' ;; '));
  await p.screenshot({ path: 'scratch/key-desk-phone.png', fullPage: true });
} catch (e) { console.log('FAILED', String(e.message||e).slice(0,200)); } finally { await b.close(); }
