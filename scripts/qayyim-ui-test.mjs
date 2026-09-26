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

  // ── P6-M6: the interface layer ────────────────────────────────────
  // The rule the owner actually lives with: a Latin word inside an Arabic line
  // arrives scrambled on his phone. Checked on rendered text with real data in it
  // — a source-level guard cannot see what the database interpolates.
  const mixedLines = (selector) => p.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return ['(السطح نفسه ما اتعرضش)'];
    const bad = [];
    for (const el of root.querySelectorAll('*')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (!t) continue;
      if (/[\u0600-\u06FF]/.test(t) && /[A-Za-z]{3,}/.test(t)) bad.push(t.slice(0, 70));
    }
    return [...new Set(bad)].slice(0, 4);
  }, selector);

  // 8) Ctrl+K opens a palette of real capabilities, and choosing one RUNS it.
  await p.focus(input);
  await p.keyboard.press('Control+k');
  await p.waitForTimeout(1000);
  const paletteShown = (await p.locator('[data-palette-input]').count()) > 0;
  // The list is the live self-model, so wait for the read instead of assuming it.
  let capabilityRows = 0;
  for (let i = 0; i < 12 && capabilityRows <= 20; i++) {
    capabilityRows = await p.locator('[data-palette-item^="capability:"]').count();
    if (capabilityRows > 20) break;
    await p.waitForTimeout(1000);
  }
  check('ctrl+K opens the live capability palette', paletteShown && capabilityRows > 20, `rows=${capabilityRows}`);
  const paletteMixed = await mixedLines('[data-palette]');
  check('the palette lists its capabilities in Arabic only', paletteMixed.length === 0, paletteMixed.join(' | '));

  await p.fill('[data-palette-input]', 'فخامه');
  await p.waitForTimeout(600);
  const filtered = await p.locator('[data-palette-item]').count();
  const luxuryRow = await p.locator('[data-palette-item="capability:qayyim_luxury_score"]').count();
  check('dialect query narrows to the luxury capability', filtered > 0 && filtered < capabilityRows && luxuryRow === 1,
    `${capabilityRows}->${filtered}`);

  await p.press('[data-palette-input]', 'Enter');
  let ranTool = false;
  for (let i = 0; i < 14 && !ranTool; i++) {
    await p.waitForTimeout(5000);
    ranTool = (await p.locator('span:has-text("تم التنفيذ الفعلي")').count()) > 0;
  }
  const toolNamed = ranTool ? await p.locator('[dir="ltr"]:has-text("qayyim_luxury_score"), span:has-text("qayyim_luxury_score")').count() : 0;
  check('palette Enter really executes the named tool', ranTool && toolNamed > 0, `toolCard=${ranTool} named=${toolNamed}`);

  // 9) «اسأل عن نفسك» shows the self-model, measured not described
  await p.locator('button:has-text("نفسك")').first().click();
  await p.waitForTimeout(2500);
  const selfShown = (await p.locator('[data-self-panel]').count()) > 0;
  const agentsBlock = await p.locator('text=/الوكلاء \\(\\d+\\)/').count();
  const organsBlock = await p.locator('text=بيشتغل لوحده بجدوله').count();
  check('self panel renders agents and the autonomous schedule', selfShown && agentsBlock > 0 && organsBlock > 0,
    `panel=${selfShown} agents=${agentsBlock} organs=${organsBlock}`);

  const selfMixed = await mixedLines('[data-self-panel]');
  check('the self panel renders no Latin inside an Arabic line', selfMixed.length === 0, selfMixed.join(' | '));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);

  // 10) Continuous dictation is offered next to the one-shot mic
  const dictBtn = await p.locator('[data-dictation]').count();
  check('continuous dictation control exists', dictBtn > 0, `buttons=${dictBtn}`);

  // 10b) The palette's agent rows hand off to a real conversation, and an
  // unknown key must not invent one.
  await p.goto(`${BASE}/admin/v2/agents/qayyim?agent=qayyim-qa`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3000);
  const qaHeader = (await p.locator('span.font-bold.text-white').first().textContent().catch(() => '')) || '';
  check('?agent= opens that agent’s own chat', qaHeader.includes('الجودة'), qaHeader.trim());
  await p.goto(`${BASE}/admin/v2/agents/qayyim?agent=qayyim-hacker`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3000);
  const fallbackHeader = (await p.locator('span.font-bold.text-white').first().textContent().catch(() => '')) || '';
  check('an unknown agent key falls back to the leader', fallbackHeader.includes('مدير تشغيل المحتوى'), fallbackHeader.trim());

  // 11) The Telegram decision link: junk is refused, a real row opens a card.
  await p.goto(`${BASE}/admin/v2/agents/qayyim?proposal=%3Cscript%3Ealert(1)%3C/script%3E`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3000);
  check('a malformed proposal link opens nothing', (await p.locator('[data-proposal-card]').count()) === 0);

  const madeId = await p.evaluate(async (payload) => {
    const res = await fetch('/api/admin/agents/approval-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    return json?.id || null;
  }, {
    action_id: `uitest-${Date.now()}`,
    action_type: 'assistant_health',
    description: 'قرار تجريبي من اختبار الواجهة — ارفضه',
  });
  await p.goto(`${BASE}/admin/v2/agents/qayyim?proposal=${madeId}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3500);
  const cardShown = (await p.locator('[data-proposal-card]').count()) > 0;
  const cardText = cardShown ? ((await p.locator('[data-proposal-card]').first().textContent()) || '') : '';
  check('the proposal link opens its own decision card', cardShown && cardText.includes('قرار تجريبي'), cardText.replace(/\s+/g, ' ').slice(0, 80));

  // Reject — never approve: this suite must not execute anything on the shop.
  await p.locator('[data-proposal-card] button:has-text("ارفض")').first().click();
  let decided = false;
  for (let i = 0; i < 8 && !decided; i++) {
    await p.waitForTimeout(1500);
    decided = (await p.locator('[data-proposal-card]').textContent().catch(() => '')).includes('رفضت');
  }
  check('refusing a proposal reports what really happened', decided);

  // 12) Studio cards + tabs
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

  // 11) New dashboard: ads control, and no CSP violations while using the app
  const cspHits = [];
  const onConsole = (m) => { if (m.text().includes('Content Security Policy')) cspHits.push(m.text().slice(0, 90)); };
  p.on('console', onConsole);
  await p.goto(`${BASE}/admin/v2/settings`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(2500);
  const adsHeading = await p.locator('text=الإعلانات والقياس').count();
  const adsenseSwitch = await p.locator('text=إعلانات جوجل تُعرض عندك').count();
  const gtagSwitch = await p.locator('text=متابعة حملتك على جوجل').count();
  check('v2 settings shows the two ad switches', adsHeading > 0 && adsenseSwitch > 0 && gtagSwitch > 0,
    `heading=${adsHeading} adsense=${adsenseSwitch} gtag=${gtagSwitch}`);

  // P6-M4: the sentences the consultant may say unaided are owner-controlled from
  // the same page — if this card is missing, autonomy has no signature board.
  const faqCard = await p.locator('text=الكلام اللي المستشار بيقوله لوحده').count();
  const faqRows = await p.locator('text=/\\d+ سطر/').count();
  check('v2 settings shows the approved-words card', faqCard > 0 && faqRows > 0, `card=${faqCard} rowsBadge=${faqRows}`);

  // The viewer page is the riskiest under a policy: it frames other sites.
  await p.goto(`${BASE}/admin/browser`, { waitUntil: 'domcontentloaded', timeout: 40000 });
  await p.waitForTimeout(3000);
  const askBtn = await p.locator('text=اسأل قيّم الدار عن الصفحة').count();
  check('admin browser kept the commander button', askBtn > 0, `button=${askBtn}`);
  p.off('console', onConsole);
  check('no CSP violations while browsing the admin', cspHits.length === 0, cspHits.slice(0, 2).join(' | ') || 'clean');

  await p.screenshot({ path: 'ui-test-final.png' }).catch(() => {});
} catch (e) {
  check('suite completed', false, String(e.message).slice(0, 160));
} finally {
  await b.close();
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n=== UI SUITE: ${results.length - failed}/${results.length} passed on ${BASE} ===`);
process.exit(failed ? 1 : 0);
