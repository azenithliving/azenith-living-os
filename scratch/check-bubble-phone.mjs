/**
 * Read the customer's chat bubble on the published site, the way his phone shows it.
 *   node scratch/check-bubble-phone.mjs [base]
 *
 * Opens the advisor on a 390px screen, asks one real shopper question through the widget's own
 * input, then reports what the bubble actually rendered — its text, whether any markdown symbol
 * survived into it, and whether the bubble honours line breaks — and saves the picture so it can
 * be looked at, not just parsed.
 */
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const QUESTION = process.argv[3] || 'عايز أعرف عندكم ركن مودرن للصة؟';
const SHOT = process.argv[4] || 'scratch/advisor-bubble-phone.png';

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

try {
  await p.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(4000);

  await p.click('.fixed.bottom-6.right-6 button', { timeout: 15000, force: true });
  await p.waitForSelector('input[type="text"]', { timeout: 15000 });
  await p.waitForTimeout(1200);

  await p.fill('input[type="text"]', QUESTION);
  await p.press('input[type="text"]', 'Enter');

  await p.waitForFunction(
    () => document.querySelectorAll('[data-chat-bubble="assistant"]').length >= 2,
    null,
    { timeout: 120000 }
  );
  await p.waitForTimeout(1500);

  const read = await p.evaluate(() => {
    const bubbles = [...document.querySelectorAll('[data-chat-bubble="assistant"]')];
    const last = bubbles[bubbles.length - 1];
    const style = getComputedStyle(last);
    return {
      count: bubbles.length,
      text: last.innerText,
      whiteSpace: style.whiteSpace,
      direction: style.direction,
      width: Math.round(last.getBoundingClientRect().width),
      height: Math.round(last.getBoundingClientRect().height),
    };
  });

  const symbols = read.text.match(/\*\*|^\s{0,3}#{1,6}\s|(?<=\s)#{1,6}\s|^\s*[-*+]\s+\S|`|\]\(/m);
  console.log(`bubbles on screen : ${read.count}`);
  console.log(`bubble box        : ${read.width}x${read.height} · white-space=${read.whiteSpace} · dir=${read.direction}`);
  console.log(`markdown symbol   : ${symbols ? 'YES -> ' + symbols[0].trim() : 'none'}`);
  console.log(`line breaks shown : ${read.text.includes('\n') ? 'yes' : 'no'}`);
  console.log('--- what the customer reads ---');
  console.log(read.text);

  await p.screenshot({ path: SHOT, fullPage: false });
  console.log(`picture: ${SHOT}`);
} catch (e) {
  console.log('FAILED', String(e.message || e).slice(0, 240));
} finally {
  await b.close();
}
