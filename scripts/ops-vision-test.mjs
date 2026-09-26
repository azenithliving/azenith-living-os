/**
 * ops-vision-test.mjs — production human-simulation:
 * logs in, uploads a real site image into the fullscreen chat,
 * waits for the live Gemini vision analysis, and captures screenshots
 * of the final product surfaces.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const BASE = 'https://azenith-living.vercel.app';
const ok = (n, p, x = '') => console.log(`${p ? 'PASS' : 'FAIL'} ${n}${x ? ' :: ' + x.slice(0, 120) : ''}`);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 25000 });
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET, step: 30, digits: 6 }));
await p.click('button[type=submit]');
await p.waitForTimeout(8000);

// Screenshot: seed card
await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForTimeout(3500);
await p.screenshot({ path: 'shot-seed-card.png' });

// Fullscreen chat + vision upload
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForSelector('input[type=file]', { timeout: 15000, state: 'attached' });
await p.setInputFiles('input[type=file]', 'test-hero.png');
let analysis = '';
for (let i = 0; i < 20 && !analysis; i++) {
  await p.waitForTimeout(5000);
  analysis = await p.locator('text=تحليل الصورة').first().textContent({ timeout: 2000 }).catch(() => '');
}
ok('live vision analysis appeared in chat', !!analysis, String(analysis).slice(0, 80));
await p.screenshot({ path: 'shot-vision-chat.png' });

// Studio screenshot
await p.goto(`${BASE}/admin/v2/ops`, { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForTimeout(4000);
await p.screenshot({ path: 'shot-studio.png' });

await b.close();
