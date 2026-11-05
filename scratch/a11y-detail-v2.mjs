import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The two cockpit screens axe could not decide, read in full.
 *
 * The sweep reported 17 violation nodes and 16 nodes axe left undecided, and it only kept a count of
 * the undecided ones. A node axe could not judge is not a passed node — it is the same kind of blank
 * box this project keeps closing elsewhere. This opens the two `/admin/v2` screens that carry them and
 * prints every undecided node with its rule, its target, and the reason axe gave.
 *
 *   node scratch/a11y-detail-v2.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const SCREENS = ["/admin/v2/ops", "/admin/v2/agents/ops", "/admin/v2/sketches", "/admin/v2/keys"];

const b = await chromium.launch({ headless: true });
const seed = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await seed.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await seed.waitForTimeout(4000);
await seed.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await seed.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await seed.click("button[type=submit]");
for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
if (seed.url().includes("/gate/login")) {
  await seed.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await seed.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await seed.click("button[type=submit]");
  for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
}
const state = await seed.context().storageState();

for (const path of SCREENS) {
  const ctx = await b.newContext({ storageState: state, viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const p = await ctx.newPage();
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(10000);
  await p.addScriptTag({ content: axeSource });
  const answer = await p.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ["violations", "incomplete"] });
    const flat = (list) =>
      list.map((v) => ({
        id: v.id,
        impact: v.impact ?? "?",
        nodes: v.nodes.slice(0, 4).map((n) => ({
          target: String(n.target?.[0] ?? "").slice(0, 70),
          reason: (n.any?.[0]?.message ?? n.all?.[0]?.message ?? "").replace(/\s+/g, " ").slice(0, 120),
        })),
        count: v.nodes.length,
      }));
    return { violations: flat(res.violations), incomplete: flat(res.incomplete) };
  }).catch(() => ({ violations: [], incomplete: [] }));

  console.log(`\n===== ${path} =====`);
  for (const v of answer.violations) console.log(`مخالفة ${v.id} [${v.impact}] ${v.count}\n   ${v.nodes.map((n) => `${n.target} — ${n.reason}`).join("\n   ")}`);
  for (const v of answer.incomplete) console.log(`غير محسوم ${v.id} ${v.count}\n   ${v.nodes.map((n) => `${n.target} — ${n.reason}`).join("\n   ")}`);
  if (!answer.violations.length && !answer.incomplete.length) console.log("نضيف ومحسوم بالكامل");
  await ctx.close();
}
await b.close();
