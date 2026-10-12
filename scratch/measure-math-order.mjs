import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does the wrapped sum actually read left to right?
 *
 * The span carries `dir="ltr"`, and my eyes on a 40-pixel crop are not evidence. This measures the
 * screen position of the first character and the last character of every drawn sum: if the first
 * character sits LEFT of the last one, the order on the glass is the order in the text.
 *
 *   node scratch/measure-math-order.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

const out = await p.evaluate(() => {
  const spans = [...document.querySelectorAll('span[data-inline="math"]')].filter((s) => s.getBoundingClientRect().width > 0);
  return spans.map((span) => {
    const text = span.textContent ?? "";
    const range = document.createRange();
    range.selectNodeContents(span);
    const first = document.createRange();
    first.setStart(span.firstChild, 0);
    first.setEnd(span.firstChild, Math.min(1, String(span.firstChild?.nodeValue ?? "").length));
    const last = document.createRange();
    const tail = String(span.firstChild?.nodeValue ?? "");
    last.setStart(span.firstChild, Math.max(0, tail.length - 1));
    last.setEnd(span.firstChild, tail.length);
    return {
      text: text.slice(0, 24),
      dir: getComputedStyle(span).direction,
      bidi: getComputedStyle(span).unicodeBidi,
      firstX: Math.round(first.getBoundingClientRect().left),
      lastX: Math.round(last.getBoundingClientRect().left),
      box: Math.round(span.getBoundingClientRect().left) + ".." + Math.round(span.getBoundingClientRect().right),
      range: Math.round(range.getBoundingClientRect().width),
    };
  });
});

console.log(`مجاميع على الشاشة: ${out.length}`);
let wrong = 0;
for (const o of out) {
  const ok = o.dir === "ltr" && o.firstX <= o.lastX;
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "صح" : "مقلوب"} | ${o.dir}/${o.bidi} | أول حرف x=${o.firstX} آخر حرف x=${o.lastX} | عرض ${o.range} | «${o.text}»`);
}
console.log(wrong ? `\nنتيجة: ${wrong} مجموعة لسه بتتقرأ من اليمين لالشمال` : "\nنتيجة: كل مجموعة بتبدأ من الشمال وتخلص على اليمين");
await b.close();
