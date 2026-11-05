import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Does a sum inside his Arabic line still read backwards?
 *
 * The glyph census counted an operator and stopped there. That was never the defect: the defect is
 * ORDER, and order belongs to direction. So this measures both, on the published screens at his width:
 *   معامل — a text node carrying `=` or `×` (the old count, kept so the numbers stay comparable);
 *   مقلوب — of those, the ones still sitting in a right-to-left line, which is what actually swaps;
 *   مرسوم — the spans this build wraps in their own direction, with what they hold.
 * It also counts the bracket lists that came out as a list, and screenshots the card that carries the
 * bestseller sum, because a number I did not look at is a number I did not prove.
 *
 *   node scratch/proof-math-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const SCREENS = ["/admin/v2/agents/ops", "/admin/v2/ops", "/admin/v2/sales", "/admin/v2", "/admin/v2/work"];

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

let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(10000);
  // The marker has to be THIS build, not the one before it: both draw math spans, and only
  // this one overrides the order. Computed `unicode-bidi` is what separates them.
  live = await p.evaluate(() =>
    [...document.querySelectorAll('span[data-inline="math"]')].some(
      (s) => getComputedStyle(s).unicodeBidi === "isolate-override",
    ),
  );
  console.log(live ? "النسخة الجديدة شغالة: المجاميع بتتقرأ بشمال لليمين فعلاً" : `مستني النسخة الجديدة (${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("العلامة ما ظهرتش — الأرقام دي من النسخة القديمة");

let ops = 0;
let flipped = 0;
let drawn = 0;
let lists = 0;
const samples = [];

for (const path of SCREENS) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const answer = await p.evaluate(() => {
    const nodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
      if (!/[=×]/.test(text)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Computed direction is NOT the question — a span can say `ltr` and still be laid out
      // right-to-left by the paragraph around it. The only honest test is where the glyphs land:
      // is the first character of this run left of its last one?
      let reversed = false;
      if (node.nodeValue.length > 1) {
        const a = document.createRange();
        a.setStart(node, 0); a.setEnd(node, 1);
        const z = document.createRange();
        z.setStart(node, node.nodeValue.length - 1); z.setEnd(node, node.nodeValue.length);
        reversed = a.getBoundingClientRect().left > z.getBoundingClientRect().left;
      }
      nodes.push({ text: text.slice(0, 110), rtl: reversed });
    }
    return {
      nodes,
      drawn: [...document.querySelectorAll('span[data-inline="math"]')].map((s) => (s.textContent ?? "").trim()).slice(0, 4),
      lists: document.querySelectorAll('[data-inline="bracket-list"]').length,
    };
  });
  const o = answer.nodes.length;
  const f = answer.nodes.filter((n) => n.rtl).length;
  ops += o;
  flipped += f;
  drawn += answer.drawn.length;
  lists += answer.lists;
  console.log(`${path}: معامل ${o} · لسه مقلوب ${f} · مرسوم ${answer.drawn.length} · قايمة ${answer.lists}`);
  for (const n of answer.nodes.filter((x) => x.rtl).slice(0, 2)) samples.push(`${path} | ${n.text}`);
  if (path === "/admin/v2/agents/ops" && answer.drawn.length) {
    await p.locator('span[data-inline="math"]').first().screenshot({ path: "scratch/math-span-390.png" }).catch(() => {});
  }
}

console.log(`\nالإجمالي على شاشاته: معامل ${ops} · منه مقلوب ${flipped} · مجاميع مرسومة ${drawn} · قايم مرسومة ${lists}`);
if (samples.length) {
  console.log("\nفاضل مقلوب:");
  for (const s of samples.slice(0, 6)) console.log(`  ${s}`);
}
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(9000);
await p.screenshot({ path: "scratch/math-screen-390.png" });
await b.close();
