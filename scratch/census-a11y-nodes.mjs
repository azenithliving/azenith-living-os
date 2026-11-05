import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Where exactly are the accessibility defects? The summary counted them; this names them.
 *
 * For each rule axe reports, this prints the element address and a short piece of its own markup, on
 * the published site at the owner's width, so the fix is written against a real node and not a guess.
 *
 *   node scratch/census-a11y-nodes.mjs
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

for (const page of PAGES) {
  await p.goto(`${BASE}${page.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  if (page.admin && !p.url().includes("/admin")) {
    console.log(`${page.label}: session lost — skipped`);
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
      help: v.help,
      nodes: v.nodes.slice(0, 4).map((n) => ({
        target: n.target.join(" "),
        html: String(n.html ?? "").replace(/\s+/g, " ").slice(0, 190),
        reason: (n.any ?? []).concat(n.failed ?? []).map((c) => c.message).join(" | ").slice(0, 110),
      })),
    }));
  });

  console.log(`\n## ${page.label} (${page.path})`);
  for (const rule of found) {
    console.log(`  [${rule.id}] ${rule.help} — ${rule.nodes.length} shown`);
    for (const node of rule.nodes) {
      console.log(`     ${node.target}`);
      console.log(`        ${node.html}`);
      if (node.reason) console.log(`        because: ${node.reason}`);
    }
  }
}

await b.close();
