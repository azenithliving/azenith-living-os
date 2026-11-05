import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Do his customers' addresses read the way they were written?
 *
 * Same rule as the sums: a declared direction is not evidence, the position of the characters is.
 * This opens the two screens that show an address — the sales office chat and the roll's no-phone
 * line — and for every isolated address reports its computed direction, where its first character
 * landed and where its last one did.
 *
 *   node scratch/proof-email-order.mjs
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
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 110)));

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

let live = false;
for (let attempt = 0; attempt < 24 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  // The marker has to be something the page prints by itself. The roll's mail line only exists once
  // a row is opened, so the marker is the chat's own address span — and the opened row is measured
  // after a click, not used as a gate.
  live = await p.evaluate(() => {
    const el = document.querySelector('span[data-inline="email"]');
    return !!el && getComputedStyle(el).unicodeBidi === "isolate-override";
  });
  console.log(live ? "النسخة الجديدة شغالة: العنوان ليه عنصر واتجاه خاصين في الشات" : `مستني النسخة الجديدة (${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("العلامة ما ظهرتش — الأرقام دي من النسخة القديمة");

// Open the first customer row so the no-phone line with its mail address is on the page.
await p.evaluate(() => {
  const row = document.querySelector('[data-telemetry], [class*="cursor-pointer"]');
  if (row) row.click();
});
await p.waitForTimeout(4000);

async function measure(label) {
  const out = await p.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-inline="email"], a[href^="mailto:"]')].filter((el) => el.getBoundingClientRect().width > 0);
    return nodes.map((el) => {
      const text = (el.textContent ?? "").trim();
      const t = el.firstChild;
      let firstX = 0;
      let lastX = 0;
      if (t && t.nodeType === 3 && t.nodeValue.length > 1) {
        const a = document.createRange();
        a.setStart(t, 0);
        a.setEnd(t, 1);
        const z = document.createRange();
        z.setStart(t, t.nodeValue.length - 1);
        z.setEnd(t, t.nodeValue.length);
        firstX = Math.round(a.getBoundingClientRect().left);
        lastX = Math.round(z.getBoundingClientRect().left);
      }
      return { text: text.slice(0, 42), dir: getComputedStyle(el).direction, bidi: getComputedStyle(el).unicodeBidi, firstX, lastX };
    });
  });
  let wrong = 0;
  console.log(`\n${label}: عناوين ${out.length}`);
  for (const o of out) {
    const ok = o.dir === "ltr" && o.bidi === "isolate-override" && (!o.firstX || o.firstX <= o.lastX);
    if (!ok) wrong += 1;
    console.log(`  ${ok ? "صح  " : "مقلوب"} | ${o.dir}/${o.bidi} | أول ${o.firstX} آخر ${o.lastX} | «${o.text}»`);
  }
  return { count: out.length, wrong };
}

const sales = await measure("دفتر العملاء");
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(11000);
const ops = await measure("شات القائد");

console.log(`\nأخطاء كونسول: ${errors.length}`);
await p.screenshot({ path: "scratch/email-order-390.png" });
console.log(
  sales.wrong + ops.wrong === 0 && sales.count + ops.count > 0
    ? "النتيجة: كل عنوان على شاشاته بيبدأ من الشمال"
    : sales.count + ops.count === 0
      ? "النتيجة: مفيش عنوان ظاهر في النافذة — القياس محتاج شاشة فيها عميل بلا رقم"
      : `النتيجة: ${sales.wrong + ops.wrong} عنوان لسه مقلوب`,
);
await b.close();
