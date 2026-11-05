import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The rest of the store, audited the same way — so the number says what it covers.
 *
 * The first pass measured six screens and came back clean. That is six screens, not the site. This runs
 * the same injected tool over twelve more: the customer's entry pages and the owner's offices. Every
 * page reports where it actually ended up, because a screen that redirects is not an audit.
 *
 *   node scratch/audit-more-screens.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const PAGES = [
  { path: "/start", label: "بداية الرحلة" },
  { path: "/rooms", label: "قايمة الغرف" },
  { path: "/furniture", label: "الأثاث" },
  { path: "/elite", label: "دخول النخبة" },
  { path: "/elite-intelligence", label: "لوحة النخبة" },
  { path: "/privacy", label: "الخصوصية" },
  { path: "/admin/v2", label: "مصفوفة القيادة", admin: true },
  { path: "/admin/v2/sales", label: "مكتب المبيعات", admin: true },
  { path: "/admin/v2/work", label: "المتابعة", admin: true },
  { path: "/admin/v2/sketches", label: "طاولة الورق", admin: true },
  { path: "/admin/v2/keys", label: "مكتب المفاتيح", admin: true },
  { path: "/admin/agents", label: "دار الموظفين (القديم)", admin: true },
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

// Wait for this build: only it makes the elite door a main region.
for (let attempt = 0; attempt < 40; attempt++) {
  await p.goto(`${BASE}/elite/login`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(7000);
  const live = await p.evaluate(() => Boolean(document.querySelector('[role="main"]')));
  if (live) {
    console.log("new build live");
    break;
  }
  console.log(`waiting for the new build (attempt ${attempt + 1})`);
  await p.waitForTimeout(20000);
}

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
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa", "wcag21aaa", "best-practice"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "unknown",
      nodes: v.nodes.length,
      sample: String(v.nodes[0]?.html ?? "").replace(/\s+/g, " ").slice(0, 110),
      target: v.nodes[0]?.target?.join(" ") ?? "",
    }));
  });
  const places = found.reduce((sum, v) => sum + v.nodes, 0);
  rows.push({ label: page.label, ended, rules: found.length, places });
  console.log(`\n## ${page.label} (${page.path} → ${ended}): ${found.length} قواعد · ${places} موضع`);
  for (const v of found.sort((a, c) => c.nodes - a.nodes).slice(0, 8)) {
    console.log(`   - ${v.id} · ${v.impact} · ${v.nodes} · ${v.target}`);
    console.log(`       ${v.sample}`);
  }
}

console.log("\n=== الإجمالي ===");
console.table(rows);
console.log(`قواعد: ${rows.reduce((s, r) => s + r.rules, 0)} · مواضع: ${rows.reduce((s, r) => s + r.places, 0)} · شاشات: ${rows.length}`);
await b.close();
