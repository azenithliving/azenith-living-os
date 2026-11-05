import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Proof on his published screens at his width: the rows read as rows.
 *
 * Three claims, each measured where it is supposed to show:
 *   ١) the roll no longer welds a room and a phone with a pipe, and its phone counts in his digits;
 *   ٢) the leader's chat draws its tables — a cell that came bold comes bold, and no marker of the
 *      model's (`**`, `[( ]()`) reaches his eyes as punctuation;
 *   ٣) the bidi shape census over all ten screens, re-counted against the 40 it stood at.
 *
 * The build marker is a string only this build can print: «غير محدد ·» — the roll's row with its two
 * facts now split by a middle dot. The old build printed «غير محدد | 01002345678» in that same slot.
 *
 *   node scratch/proof-rows-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const MARKER = "غير محدد ·";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const SCREENS = [
  "/admin/v2/agents/ops",
  "/admin/v2/ops",
  "/admin/v2/sales",
  "/admin/v2",
  "/admin/v2/work",
  "/admin/v2/sketches",
  "/admin/v2/keys",
  "/admin/database",
  "/admin",
  "/admin/agents",
];

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

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
for (let attempt = 0; attempt < 40 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  live = await p.evaluate((marker) => document.body.innerText.includes(marker), MARKER);
  console.log(live ? "النسخة الجديدة طلعت (الدفتر بيقول «من غير طلب»)" : `مستني النسخة الجديدة (${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("العلامة ما ظهرتش — الأرقام دي من النسخة القديمة");

// ١) the roll's own line
const roll = await p.evaluate(() => {
  const AR = /[٠-٩]/;
  const rows = [...document.querySelectorAll("p")].filter((el) => {
    const t = (el.textContent ?? "").trim();
    return /\d{6,}|[٠-٩]{6,}/.test(t) && t.length < 80 && el.getBoundingClientRect().height > 0;
  });
  return {
    read: rows.length,
    withPipe: rows.filter((el) => (el.textContent ?? "").includes("|")).length,
    latinDigits: rows.filter((el) => /[0-9]{6,}/.test(el.textContent ?? "")).length,
    arabicDigits: rows.filter((el) => AR.test(el.textContent ?? "")).length,
    samples: rows.slice(0, 3).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60)),
  };
});
console.log(`الدفتر: سطور ${roll.read} · فيها.pipe ${roll.withPipe} · أرقام لاتينية ${roll.latinDigits} · أرقام عربية ${roll.arabicDigits}`);
for (const s of roll.samples) console.log(`   «${s}»`);
await p.screenshot({ path: "scratch/rows-roll-390.png", fullPage: false });

// ٢) the leader's chat draws its tables
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(11000);
// The drawing marker, read positively: `align-top` cells exist only in a build whose table renderer
// runs the inline pass, and a raw «](http» on the page would mean a markdown link printed its marks.
// What the last commit changed is the ORDER inside one function, and no stored message with a real
// link is inside the visible window — so there is no string on his screens that only that commit can
// print. It is proven by its guard test and by this zero, and said so in the minute.
let drawn = false;
for (let attempt = 0; attempt < 6 && !drawn; attempt++) {
  drawn = await p.evaluate(
    () => {
      const t = document.body.innerText;
      return !!document.querySelector("td.align-top") && !t.includes("](http");
    },
  );
  console.log(drawn ? "العلامة التالتة: الجدول مرسوم بالخلايا الجديدة وما فيش رابط مطبوع علامات" : `مستني النسخة التالتة (${attempt + 1})`);
  if (!drawn) {
    await p.waitForTimeout(20000);
    await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(11000);
  }
}
const chat = await p.evaluate(() => {
  const txt = document.body.innerText;
  const tables = [...document.querySelectorAll("table")].filter((t) => t.getBoundingClientRect().height > 0);
  const boldCells = tables.reduce((n, t) => n + [...t.querySelectorAll("td strong, th strong")].length, 0);
  const rawMarks = (txt.match(/\*\*/g) ?? []).length;
  const rawLinks = (txt.match(/\]\(http/g) ?? []).length;
  const links = [...document.querySelectorAll('a[data-emphasis="link"]')].length;
  return { tables: tables.length, boldCells, rawMarks, rawLinks, links };
});
console.log(`الشات: جداول ${chat.tables} · خلايا غامقة ${chat.boldCells} · نجوم ${chat.rawMarks} · أقواس رابط ${chat.rawLinks} · روابط مرسومة ${chat.links}`);
if (chat.tables) await p.locator("table").first().screenshot({ path: "scratch/rows-table-390.png" }).catch(() => {});
await p.screenshot({ path: "scratch/rows-chat-390.png" });

// ٣) the shape census, same instrument as before
const totals = { operator: 0, brackets: 0, arrows: 0, "bare-latin": 0 };
const lines = { operator: [], brackets: [], arrows: [], "bare-latin": [] };
for (const path of SCREENS) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const found = await p.evaluate(() => {
    const AR = /[\u0600-\u06FF]/;
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
      if (text.length < 4 || !AR.test(text)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const kinds = [];
      if (/[=×|]/.test(text) || /→/.test(text)) kinds.push("operator");
      if (/[→←⇄]/.test(text)) kinds.push("arrows");
      if (/\([^)]*\(/.test(text) || (/\(.+?\)/.test(text) && /[A-Za-z]{2,}/.test(text.match(/\([^)]*\)/)?.[0] ?? ""))) kinds.push("brackets");
      if ((text.match(/[A-Za-z]{3,}/g) ?? []).length) kinds.push("bare-latin");
      if (!kinds.length) continue;
      hits.push({ kinds, text: text.slice(0, 130) });
    }
    return hits;
  });
  const per = { operator: 0, brackets: 0, arrows: 0, "bare-latin": 0 };
  for (const h of found) for (const k of h.kinds) {
    per[k] += 1;
    totals[k] += 1;
    if (lines[k].length < 6) lines[k].push(`${path} ${h.text}`);
  }
  console.log(`${path}: ${found.length} · عامل ${per.operator} · قوس ${per.brackets} · سهم ${per.arrows} · لاتيني ${per["bare-latin"]}`);
}
console.log(`\nالإجمالي: ${JSON.stringify(totals)}`);
for (const [kind, samples] of Object.entries(lines)) {
  if (!samples.length) continue;
  console.log(`\n--- ${kind} ---`);
  for (const s of samples.slice(0, 4)) console.log(`  ${s}`);
}
console.log(`\nأخطاء Console: ${errors.length}`);
for (const e of errors.slice(0, 4)) console.log(`  ${e}`);
await b.close();
