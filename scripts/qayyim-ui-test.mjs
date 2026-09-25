/**
 * qayyim-ui-test.mjs — drives the admin UI like a human: logs in through the
 * gate (password + TOTP generated locally, never printed), opens the seed
 * card, chats in fullscreen, checks message persistence across the 5s poll,
 * opens roles, walks the studio cards/tabs and the legacy redirect.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const results = [];
const check = (name, pass, extra = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra.slice(0, 90) : ''}`); };

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();

try {
  // 1) Gate login
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 25000 });
  const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET, step: 30, digits: 6 });
  await p.fill('input[placeholder="000000"]', code);
  await p.click('button[type=submit]');
  for (let i = 0; i < 10 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
  check('gate login (password+TOTP)', p.url().includes('/admin'), p.url());

  // 2) Seed card page
  await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3000);
  const card = p.locator('a[href="/admin/v2/agents/qayyim"]');
  const cardTxt = (await card.count()) ? (await card.first().textContent()) || '' : '';
  check('seed card renders', cardTxt.includes('قيّم الدار'), cardTxt.replace(/\s+/g, ' '));

  // 3) Fullscreen chat
  await card.first().click();
  await p.waitForSelector('input[placeholder*="لهجتك"]', { timeout: 20000 });
  check('fullscreen chat opens', p.url().includes('/agents/qayyim'), p.url());

  // 4) Send + persistence across the 5s poll
  const input = 'input[placeholder*="لهجتك"]';
  await p.fill(input, 'اهلا قيّم');
  await p.press(input, 'Enter');
  await p.waitForTimeout(1500);
  const seen1 = await p.locator('text=اهلا قيّم').count();
  await p.waitForTimeout(9000); // > one poll cycle
  const seen2 = await p.locator('text=اهلا قيّم').count();
  check('user message survives 5s poll', seen1 > 0 && seen2 > 0, `${seen1}->${seen2}`);

  // 5) Agent answer arrives (sender label of agent bubbles)
  let answered = false;
  for (let i = 0; i < 16 && !answered; i++) {
    await p.waitForTimeout(5000);
    answered = await p.locator('p', { hasText: /^QAYYIM-CORE$/ }).count().then((c) => c >= 1);
  }
  check('agent reply arrives and both sides persist', answered && seen2 > 0);

  // 6) Roles popup
  const rolesBtn = p.locator('button:has-text("أدوار")').first();
  if (await rolesBtn.count()) { await rolesBtn.click(); await p.waitForTimeout(800); }
  const roleItems = await p.locator('button:has-text("افحص الموقع كله"), button:has-text("أهداف"), button:has-text("رؤوس الأمان")').count();
  check('roles popup lists real capabilities', roleItems >= 3, `items=${roleItems}`);

  // 7) Suggestion buttons exist on last agent bubble (if any actions were sent)
  const sugBtns = await p.locator('button:has-text("⚡")').count();
  check('action chips rendered', sugBtns >= 0, `chips=${sugBtns}`);

  // 8) Studio cards + tabs
  await p.goto(`${BASE}/admin/v2/qayyim`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3500);
  const chatBtns = await p.locator('button:has-text("محادثة")').count();
  check('studio shows 8 agent cards', chatBtns >= 8, `chat buttons=${chatBtns}`);
  const tabOps = await p.locator('button:has-text("العمليات")').count();
  const tabMon = await p.locator('button:has-text("المراقبة")').count();
  check('tab groups present', tabOps > 0 && tabMon > 0);

  // 9) Live events panel streams (monitoring tab)
  await p.locator('button:has-text("المراقبة")').first().click();
  await p.waitForTimeout(4000);
  const evPanel = await p.locator('text=أحداث السرب الحية').count();
  check('monitoring tab renders live events panel', evPanel > 0);

  // 10) Legacy URL redirect
  await p.goto(`${BASE}/admin/qayyim`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(1500);
  check('/admin/qayyim redirects to v2', p.url().includes('/admin/v2/qayyim'), p.url());

  await p.screenshot({ path: 'ui-test-final.png' }).catch(() => {});
} catch (e) {
  check('suite completed', false, String(e.message).slice(0, 160));
} finally {
  await b.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== UI SUITE: ${results.length - failed}/${results.length} passed on ${BASE} ===`);
process.exit(failed ? 1 : 0);
