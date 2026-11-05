import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The same audit, run again after the fix — a before/after, not a claim.
 *
 * The build marker is the fix itself: the advisor bubble carries an accessible name only in the new
 * code, so the instrument waits for that name to appear on the published site before it measures.
 * The "before" numbers are printed beside the new ones so the difference is arithmetic, not memory.
 *
 *   node scratch/measure-accessibility-after.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const BEFORE = {
  "الواجهة": { rules: 4, places: 5 },
  "غرفة معيشة": { rules: 4, places: 7 },
  "كراسة العميل": { rules: 5, places: 6 },
  "الشروط": { rules: 4, places: 4 },
  "كابينة القائد": { rules: 3, places: 5 },
  "حالة النظام": { rules: 2, places: 3 },
};

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const PAGES = [
  { path: "/", label: "الواجهة" },
  { path: "/rooms/living-room", label: "غرفة معيشة" },
  { path: "/request", label: "كراسة العميل" },
  { path: "/terms", label: "الشروط" },
  { path: "/admin/v2/ops", label: "كابينة القائد", admin: true },
  { path: "/admin/database", label: "حالة النظام", admin: true },
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

// Wait for the new build: only it asks the customer's first question at heading level two.
let named = false;
for (let attempt = 0; attempt < 50; attempt++) {
  await p.goto(`${BASE}/request`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(8000);
  named = await p.evaluate(() => {
    const heading = [...document.querySelectorAll("h2")].find((h) => /أولاً/.test(h.textContent ?? ""));
    return Boolean(heading);
  });
  if (named) {
    console.log(`new build live (attempt ${attempt + 1})`);
    break;
  }
  console.log(`waiting for the new build (attempt ${attempt + 1})`);
  await p.waitForTimeout(20000);
}
if (!named) {
  console.log("the new build never appeared — nothing measured");
  await b.close();
  process.exit(1);
}

let totalRules = 0;
let totalPlaces = 0;
for (const page of PAGES) {
  await p.goto(`${BASE}${page.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  if (page.admin && !p.url().includes("/admin")) {
    console.log(`${page.label}: session lost`);
    continue;
  }
  await p.addScriptTag({ content: axeSource });
  const found = await p.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa", "wcag21aaa", "best-practice"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact ?? "unknown", nodes: v.nodes.length }));
  });
  const places = found.reduce((sum, v) => sum + v.nodes, 0);
  totalRules += found.length;
  totalPlaces += places;
  const before = BEFORE[page.label] ?? { rules: 0, places: 0 };
  console.log(`\n## ${page.label}: قواعد ${before.rules} → ${found.length} · مواضع ${before.places} → ${places}`);
  for (const v of found) console.log(`   - ${v.id} · ${v.impact} · ${v.nodes}`);
}

const beforeRules = Object.values(BEFORE).reduce((s, v) => s + v.rules, 0);
const beforePlaces = Object.values(BEFORE).reduce((s, v) => s + v.places, 0);
console.log(`\n=== الإجمالي ===\nقواعد: ${beforeRules} → ${totalRules} · مواضع: ${beforePlaces} → ${totalPlaces}`);
await b.close();
