import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Where exactly the remaining 44 places live.
 *
 * The twelve-screen audit printed one sample per rule; eight unnamed buttons are one rule, but they are
 * not eight copies of the same control. This prints every violating node with its own target and its
 * own html, so each one can be traced to the line that renders it instead of guessed from a class.
 *
 *   node scratch/census-a11y-residue.mjs
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
  { path: "/admin/v2/sales", label: "مكتب المبيعات" },
  { path: "/admin/agents", label: "دار الموظفين" },
  { path: "/admin/v2/sketches", label: "طاولة الورق" },
  { path: "/admin/v2", label: "مصفوفة القيادة" },
  { path: "/admin/v2/keys", label: "مكتب المفاتيح" },
  { path: "/elite/login", label: "دخول النخبة" },
  { path: "/elite-intelligence", label: "لوحة النخبة" },
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

let total = 0;
for (const page of PAGES) {
  await p.goto(`${BASE}${page.path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const ended = p.url().replace(BASE, "") || "/";
  await p.addScriptTag({ content: axeSource });
  const found = await p.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag2aaa", "wcag21aaa", "best-practice"] },
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? "unknown",
      nodes: v.nodes.map((n) => ({
        target: (n.target ?? []).join(" "),
        html: String(n.html ?? "").replace(/\s+/g, " ").slice(0, 240),
        message: String((n.any?.[0]?.message ?? n.failureSummary ?? "").replace(/\s+/g, " ")).slice(0, 200),
      })),
    }));
  });
  const places = found.reduce((s, v) => s + v.nodes.length, 0);
  total += places;
  console.log(`\n===== ${page.label} (${ended}) — ${found.length} قواعد · ${places} موضع =====`);
  for (const v of found.sort((a, c) => c.nodes.length - a.nodes.length)) {
    console.log(`\n--- ${v.id} · ${v.impact} · ${v.nodes.length}`);
    for (const n of v.nodes) {
      console.log(`  [${n.target}]`);
      console.log(`    ${n.html}`);
      console.log(`    => ${n.message}`);
    }
  }
}

console.log(`\n=== مواضع محلولة العرض: ${total} ===`);
await b.close();
