/**
 * Press the customer's consultant on the published site, as a visitor would.
 *   node scratch/check-consultant-live.mjs [base]
 *
 * Two questions: does a normal Arabic message get an Arabic answer, and does the store still
 * answer in Arabic when the model does not (measured by asking something the rules cannot know,
 * then reading what came back). Reports the reply, the language of it, the queue it left behind,
 * and any console error.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 90)));

const arabicShare = (s) => {
  const letters = (s.match(/\p{Script=Arabic}/gu) || []).length + (s.match(/[A-Za-z]/g) || []).length;
  return letters ? Math.round(((s.match(/\p{Script=Arabic}/gu) || []).length / letters) * 100) : 0;
};

try {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(4000);

  const ask = async (message, sessionId) => {
    const res = await p.evaluate(async ({ msg, sid }) => {
      const r = await fetch('/api/consultant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: sid, language: 'ar' }),
      });
      const j = await r.json().catch(() => ({}));
      return { status: r.status, reply: j.reply ?? null, error: j.error ?? null, stack: j.stack ?? null, sessionId: j.sessionId ?? sid };
    }, { msg: message, sid: sessionId });
    return res;
  };

  const sid = `live-probe-${Date.now()}`;
  const first = await ask('عايز أعرف مفي عندكم ركن مودرن للصاله؟', sid);
  console.log('Q1 status', first.status, '| arabic share', arabicShare(first.reply ?? String(first.error)), '| stack in body:', first.stack ? 'YES' : 'no');
  console.log('A1', String(first.reply ?? first.error).replace(/\s+/g, ' ').slice(0, 260));

  const second = await ask('إيه آخر موضة في أثاث مكاتب الاستقبال في ميلانو سنة ٢٠٢٧ بالتفصيل؟', sid);
  console.log('Q2 status', second.status, '| arabic share', arabicShare(second.reply ?? String(second.error)));
  console.log('A2', String(second.reply ?? second.error).replace(/\s+/g, ' ').slice(0, 260));

  // The widget itself: does it open and show the conversation on a phone?
  const opened = await p.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const launcher = buttons.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 30 && r.height > 30 && r.bottom > window.innerHeight - 220 && r.right > window.innerWidth - 120;
    });
    if (!launcher) return 'no launcher found';
    launcher.click();
    return 'clicked';
  });
  await p.waitForTimeout(3500);
  const box = await p.locator('input[placeholder="اكتب رسالتك..."]').count();
  console.log('WIDGET', opened, '| input visible after click:', box);
  await p.screenshot({ path: 'scratch/consultant-live-phone.png' });
  console.log('ERRORS', errs.length, errs.slice(0, 2).join(' ;; '));
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 250));
} finally {
  await b.close();
}
