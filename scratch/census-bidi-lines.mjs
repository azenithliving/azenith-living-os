import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * How many of his lines are physically scrambled, and by what.
 *
 * The owner's rule is not cosmetic: a Latin operator or a nested bracket inside an Arabic sentence
 * makes the bidi renderer reorder the run, so the line reads wrong on the screen even though the text
 * in the database is right. Before choosing a fix, count the shapes that cause it — measured on the
 * published screens at his width, in the text a screen reader would also read.
 *
 * Classes, kept separate because they get different repairs:
 *   operator   — «=», «×», «→», «|», «%» sitting between Arabic words
 *   brackets   — a bracket that opens another bracket, or holds Latin inside Arabic
 *   arrows     — the two glyphs that flip a line on their own
 *   bare-latin — a Latin word left mid-sentence (the voice pass could not name it)
 *
 *   node scratch/census-bidi-lines.mjs
 */
const BASE = "https://azenith-living.vercel.app";

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

// The build marker is the repair itself, checked where the defect was last standing: the cockpit's
// own cards. The chat was already clean in the previous build, so watching only it proves nothing.
let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  live = await p.evaluate(
    () =>
      !/←|→/.test(document.body.innerText) &&
      document.body.innerText.includes("طلب تعديل · استعادة عملاء"),
  );
  console.log(live ? "new build live (cockpit clean, inline pipe flattened)" : `waiting for the new build (attempt ${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("MARKER NEVER APPEARED — these numbers are the old build");

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
      hits.push({ kinds, text: text.slice(0, 130), tag: el.tagName.toLowerCase(), dir: style.direction });
    }
    return hits;
  });

  const perScreen = { operator: 0, brackets: 0, arrows: 0, "bare-latin": 0 };
  for (const h of found) for (const k of h.kinds) { perScreen[k] += 1; totals[k] += 1; if (lines[k].length < 8) lines[k].push(`${path} <${h.tag}> ${h.text}`); }
  console.log(
    `${path}: سطور عليها علامة ${found.length} · عامل ${perScreen.operator} · قوس ${perScreen.brackets} · سهم ${perScreen.arrows} · كلمة لاتينية ${perScreen["bare-latin"]}`,
  );
}

console.log("\n=== الإجمالي على شاشات المالك ===");
console.log(JSON.stringify(totals));
for (const [kind, samples] of Object.entries(lines)) {
  console.log(`\n--- أمثلة: ${kind} ---`);
  for (const s of samples.slice(0, 6)) console.log(`  ${s}`);
}
await b.close();
