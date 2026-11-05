/**
 * A human walk-through of the REAL published site, at phone width, with a screenshot
 * of every step. Nothing here asserts from the DOM alone — every step is captured so
 * the pictures can be looked at.
 */
import { chromium } from '@playwright/test';
import speakeasy from 'speakeasy';
import fs from 'fs';

const BASE = 'https://azenith-living.vercel.app';
const DIR = 'scratch/live-proof';
fs.mkdirSync(DIR, { recursive: true });

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const log = [];
const say = (s) => { log.push(s); console.log(s); };
const shot = async (p, name) => {
  await p.screenshot({ path: `${DIR}/${name}.png` });
  say(`SHOT ${name}.png`);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar-EG' });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 100)));
p.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 100)));

const INPUT = 'input[placeholder*="لهجتك"]';

try {
  // ── 1. the gate, like a person ─────────────────────────────────────
  await p.goto(`${BASE}/gate/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
  await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
  await p.click('button[type=submit]');
  await p.waitForSelector('input[placeholder="000000"]', { timeout: 30000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
  await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: 'base32', step: 30, digits: 6 }));
  await p.click('button[type=submit]');
  for (let i = 0; i < 15 && !p.url().includes('/admin'); i++) await p.waitForTimeout(2000);
  say(`1 login ${p.url().includes('/admin') ? 'ok' : 'FAILED'} -> ${p.url()}`);

  // ── 2. the command canvas ──────────────────────────────────────────
  await p.goto(`${BASE}/admin/v2/agents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(12000);
  const cards = await p.locator('[data-employee-card]').evaluateAll((els) =>
    els.map((e) => ({ key: e.getAttribute('data-employee-card'), href: e.getAttribute('href') }))
  );
  say(`2 canvas cards=${cards.length} keys=${cards.map((c) => c.key).join(',')}`);
  await shot(p, '01-canvas-full');
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(800);
  await shot(p, '02-canvas-bottom');
  await p.evaluate(() => window.scrollTo(0, 0));

  // ── 3. open the leader and ASK him who he is ───────────────────────
  await p.click('[data-employee-card="ops-lead"]');
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(4000);
  await shot(p, '03-leader-chat-open');

  const probe = `اختبار حيّ ${Date.now()}: قولي انت مين بالظبط، وبتقدر تعمل ايه ليا في المتجر؟`;
  await p.fill(INPUT, probe);
  await p.press(INPUT, 'Enter');
  let bubblesBefore = await p.locator('[data-chat-header]').count();
  let replied = false;
  for (let i = 0; i < 24 && !replied; i++) {
    await p.waitForTimeout(5000);
    const mine = await p.locator(`text=اختبار حيّ`).count();
    const total = await p.locator('p, div').evaluateAll(
      (els) => els.filter((e) => !e.children.length && (e.textContent || '').trim().length > 40).length
    );
    replied = mine > 0 && total > bubblesBefore + 4;
    bubblesBefore = total;
  }
  say(`3 sent a real message and an answer arrived=${replied}`);
  await shot(p, '04-leader-answer');

  // ── 4. the roles strip ─────────────────────────────────────────────
  await p.click('button[title="أدوار وقدرات الوكيل"]');
  await p.waitForTimeout(1200);
  await shot(p, '05-roles-strip');
  await p.click('button[title="أدوار وقدرات الوكيل"]');

  // ── 5. the decisions vault ─────────────────────────────────────────
  await p.click('[data-decisions-toggle]');
  await p.waitForTimeout(3500);
  const vault = ((await p.locator('[data-decision-vault]').textContent().catch(() => '')) || '')
    .replace(/\s+/g, ' ').trim();
  say(`5 vault ${vault.slice(0, 90)}`);
  await shot(p, '06-decisions-vault');
  await p.click('[data-decisions-toggle]');

  // ── 6. the actions drawer, and press a tool that really runs ───────
  await p.click('[data-actions-toggle]');
  await p.waitForTimeout(1500);
  await shot(p, '07-actions-drawer');
  const health = p.locator('[data-actions-drawer] button:has-text("فحص صحة الصفحات")').first();
  if (await health.count()) {
    await health.click();
    let outcome = '';
    for (let i = 0; i < 20 && !outcome; i++) {
      await p.waitForTimeout(3000);
      outcome = ((await p.locator('[data-actions-drawer] .border-emerald-500\\/20, [data-actions-drawer] .border-rose-500\\/20').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    }
    say(`6 pressed a real tool, the drawer answered: ${outcome.slice(0, 110) || '(no answer)'}`);
    await shot(p, '08-tool-result');
  } else {
    say('6 the page-health tile was not found');
  }
  await p.click('[data-actions-toggle]');

  // ── 7. the red strip, raised for real ──────────────────────────────
  const fired = await p.evaluate(async () => {
    const r = await fetch('/api/admin/ops?action=sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subaction: 'publish', event_type: 'anomaly_detected', source_agent: 'OPS-LEAD',
        target_agents: [], payload: { summary: 'انخفاض مفاجئ في صفحات تردّ بخطأ' },
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  say(`7 raised an alert through the swarm's own door http=${fired.status}`);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(6000);
  const banner = ((await p.locator('[data-emergency-banner]').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  say(`7 strip on screen: ${banner.slice(0, 120) || '(absent)'}`);
  await shot(p, '09-red-strip');

  if (banner) {
    await p.click('[data-alert-ack]');
    await p.waitForTimeout(3000);
    const after = await p.locator('[data-emergency-banner]').count();
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForSelector(INPUT, { timeout: 45000 });
    await p.waitForTimeout(6000);
    const afterReload = await p.locator('[data-emergency-banner]').count();
    say(`7 acknowledged: on screen right after=${after} after reload=${afterReload}`);
    await shot(p, '10-after-acknowledge');
  }

  // ── 8. another employee, to prove the doors are not one page ───────
  await p.goto(`${BASE}/admin/v2/agents/ops?agent=ops-content`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForSelector(INPUT, { timeout: 45000 });
  await p.waitForTimeout(4000);
  const who = ((await p.locator('[data-chat-header]').first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  say(`8 the content employee's chat header: ${who.slice(0, 70)}`);
  await shot(p, '11-content-employee');

  // ── 9. the storefront on the same phone, untouched by today ────────
  await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(6000);
  say(`9 storefront title=${await p.title()}`);
  await shot(p, '12-storefront-phone');
} catch (e) {
  say(`CRASH ${e.message}`);
} finally {
  say(`CONSOLE_ERRORS ${errors.length}${errors.length ? ' :: ' + [...new Set(errors)].slice(0, 4).join(' | ') : ''}`);
  fs.writeFileSync(`${DIR}/run.txt`, log.join('\n'));
  await b.close();
}
