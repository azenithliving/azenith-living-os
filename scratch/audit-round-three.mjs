import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The whole audited set, measured again after round three — eighteen screens, not the twelve that were
 * broken.
 *
 * The build marker is the repair itself: only the new code names the chat's send arrow, so the
 * instrument waits for that name on the published site before it counts anything. Screens are the six
 * from round one (so a repair on the owner's side cannot silently break the customer's) plus the twelve
 * from round two. Any node still failing is printed in full, because a count without a name under it is
 * how last week's clean number got published.
 *
 *   node scratch/audit-round-three.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

// What each screen measured immediately before this round — not the original numbers, so the arithmetic
// under this report is the size of this round's work.
const BEFORE = {
  الواجهة: [0, 0],
  "غرفة معيشة": [0, 0],
  "كراسة العميل": [0, 0],
  الشروط: [0, 0],
  "كابينة القائد": [0, 0],
  "حالة النظام": [0, 0],
  "بداية الرحلة": [0, 0],
  "قايمة الغرف": [0, 0],
  الأثاث: [0, 0],
  "دخول النخبة": [1, 1],
  "لوحة النخبة": [1, 1],
  الخصوصية: [0, 0],
  "مصفوفة القيادة": [1, 4],
  "مكتب المبيعات": [3, 11],
  المتابعة: [0, 0],
  "طاولة الورق": [3, 7],
  "مكتب المفاتيح": [1, 3],
  "دار الموظفين (القديم)": [4, 17],
};

const PAGES = [
  { path: "/", label: "الواجهة" },
  { path: "/rooms/living-room", label: "غرفة معيشة" },
  { path: "/request", label: "كراسة العميل" },
  { path: "/terms", label: "الشروط" },
  { path: "/admin/v2/ops", label: "كابينة القائد", admin: true },
  { path: "/admin/database", label: "حالة النظام", admin: true },
  { path: "/start", label: "بداية الرحلة" },
  { path: "/rooms", label: "قايمة الغرف" },
  { path: "/furniture", label: "الأثاث" },
  { path: "/elite", label: "دخول النخبة" },
  { path: "/elite-intelligence", label: "لوحة النخبة" },
  { path: "/privacy", label: "الخصوصية" },
  { path: "/admin/v2", label: "مصفوفة القيادة", admin: true },
  { path: "/admin/v2/sales", label: "مكتب المبيعات", admin: true, shoot: "scratch/shot-sales-390.png" },
  { path: "/admin/v2/work", label: "المتابعة", admin: true },
  { path: "/admin/v2/sketches", label: "طاولة الورق", admin: true, shoot: "scratch/shot-sketches-390.png" },
  { path: "/admin/v2/keys", label: "مكتب المفاتيح", admin: true },
  { path: "/admin/agents", label: "دار الموظفين (القديم)", admin: true, shoot: "scratch/shot-agents-390.png" },
];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const consoleErrors = [];
p.on("console", (m) => m.type() === "error" && consoleErrors.push(`${m.text().slice(0, 160)} @ ${p.url().replace(BASE, "")}`));
p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 160)}`));

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

// Wait for this build: only it gives the chat's send arrow a name.
let live = false;
for (let attempt = 0; attempt < 40 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(8000);
  live = await p.evaluate(() => Boolean(document.querySelector('button[aria-label="إرسال الرسالة"], button[aria-label="الموظف بيكتب دلوقتي"]')));
  if (!live) console.log(`waiting for the new build (attempt ${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
console.log(live ? "new build live (the send arrow carries a name)" : "MARKER NEVER APPEARED — results below are the old build");

const rows = [];
for (const page of PAGES) {
  await p.goto(`${BASE}${page.path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const ended = p.url().replace(BASE, "") || "/";
  if (page.admin && !ended.includes("/admin")) {
    console.log(`${page.label}: ended at ${ended} — session did not reach it`);
    continue;
  }
  await p.addScriptTag({ content: axeSource });
  const found = await p.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa", "wcag21aaa", "best-practice"] },
      resultTypes: ["violations"],
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "unknown",
      nodes: v.nodes.map((n) => ({
        target: (n.target ?? []).join(" "),
        html: String(n.html ?? "").replace(/\s+/g, " ").slice(0, 200),
        message: String((n.any?.[0]?.message ?? n.failureSummary ?? "").replace(/\s+/g, " ")).slice(0, 170),
      })),
    }));
  });
  const places = found.reduce((s, v) => s + v.nodes.length, 0);
  const [br, bp] = BEFORE[page.label] ?? [0, 0];
  rows.push({ label: page.label, rules: found.length, places });
  console.log(`\n## ${page.label}: قواعد ${br} → ${found.length} · مواضع ${bp} → ${places}`);
  for (const v of found.sort((a, c) => c.nodes.length - a.nodes.length)) {
    for (const n of v.nodes) {
      console.log(`   - ${v.id} · ${v.impact} · [${n.target}]`);
      console.log(`       ${n.html}`);
      console.log(`       => ${n.message}`);
    }
  }
  if (page.shoot) {
    await p.screenshot({ path: page.shoot, fullPage: false });
    console.log(`   لقطة: ${page.shoot}`);
  }
}

const tr = rows.reduce((s, r) => s + r.rules, 0);
const tp = rows.reduce((s, r) => s + r.places, 0);
const tb = Object.values(BEFORE).reduce((s, v) => s + v[0], 0);
const tbp = Object.values(BEFORE).reduce((s, v) => s + v[1], 0);
console.log(`\n=== الإجمالي على ${rows.length} شاشة ===`);
console.log(`قواعد: ${tb} → ${tr} · مواضع: ${tbp} → ${tp}`);
console.log(`خطأ كونسول: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 10)) console.log("   ! " + e);
writeFileSync("scratch/round-three.out.json", JSON.stringify({ rows, consoleErrors }, null, 1), "utf8");
await b.close();
