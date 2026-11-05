import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The accessibility sweep of every admin screen — not the ones already known to be clean.
 *
 * The audit so far covered eighteen screens, and the owner's own house has thirty routes under
 * `/admin`. A number that covers six or eighteen of thirty is not "zero violations"; it is zero on
 * the screens someone looked at. This walks every route, signs in ONCE, opens each one in a fresh
 * context so one screen's errors cannot be blamed on another, injects the shipping axe build, and
 * prints per screen: the rules that failed, how many nodes each one caught, and one real target so
 * the count can be checked by hand.
 *
 * It also counts the nodes axe could not judge (incomplete/outstanding), because an unchecked node
 * is not a passed node.
 *
 *   node scratch/sweep-a11y-admin.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const STATE = "scratch/admin-session.json";
const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

const ROUTES = [
  "/admin",
  "/admin/agents",
  "/admin/assistant",
  "/admin/browser",
  "/admin/computer",
  "/admin/database",
  "/admin/elite",
  "/admin/fate",
  "/admin/intel",
  "/admin/intelligence",
  "/admin/owner-dashboard",
  "/admin/phone",
  "/admin/sales",
  "/admin/sandbox",
  "/admin/settings",
  "/admin/system",
  "/admin/v2",
  "/admin/v2/agents",
  "/admin/v2/agents/ops",
  "/admin/v2/database",
  "/admin/v2/elite",
  "/admin/v2/keys",
  "/admin/v2/ops",
  "/admin/v2/owner-dashboard",
  "/admin/v2/sales",
  "/admin/v2/settings",
  "/admin/v2/sketches",
  "/admin/v2/system",
  "/admin/v2/work",
  "/admin/work",
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });

// Always sign in fresh. A saved session from last night is exactly what makes a sweep report thirty
// screens that never opened and a clean total of zero.
const seed = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
// The published site answers from a cold edge sometimes slowly enough to time a single navigation
// out; one dead attempt is not a reason to report thirty unmeasured screens.
for (let attempt = 0; attempt < 4; attempt++) {
  try {
    await seed.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    break;
  } catch (e) {
    console.log(`الدخول للموقع فشل (${attempt + 1}/4): ${String(e).slice(0, 60)}`);
    await seed.waitForTimeout(15000);
    if (attempt === 3) throw e;
  }
}
await seed.waitForTimeout(4000);
await seed.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await seed.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await seed.click("button[type=submit]");
// Owner's word 2026-10-19: the dashboard opens with the password alone. The code step is only walked
// when it actually appears, so the sweep keeps working whichever way the settings row says.
for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
if (seed.url().includes("/gate/login")) {
  await seed.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
  const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  await seed.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
  await seed.click("button[type=submit]");
  for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
}
if (!seed.url().includes("/admin")) {
  console.log("الدخول ما تمّش — اللفة كلها مرفوضة بدل رقم ناقص");
  await b.close();
  process.exit(1);
}
await seed.context().storageState({ path: STATE });
console.log("دخلة جديدة، والجلسة محفوظة");

const report = [];
for (const path of ROUTES) {
  const ctx = await b.newContext({ storageState: STATE, viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 100)));
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  if (p.url().includes("/gate/login")) {
    report.push({ path, landed: "الباب رجع لصفحة الدخول", violations: -1, rules: [], incomplete: 0, errors: errors.length });
    await ctx.close();
    continue;
  }
  await p.addScriptTag({ content: axeSource });
  const answer = await p.evaluate(async () => {
    const res = await window.axe.run(document, { resultTypes: ["violations", "incomplete"] });
    const flat = (list) =>
      list.map((v) => ({
        id: v.id,
        impact: v.impact ?? "?",
        nodes: v.nodes.length,
        sample: String(v.nodes[0]?.target?.[0] ?? "").slice(0, 70),
      }));
    return { violations: flat(res.violations), incomplete: flat(res.incomplete) };
  }).catch((e) => ({ violations: [], incomplete: [], failed: String(e).slice(0, 80) }));

  const count = answer.violations.reduce((n, v) => n + v.nodes, 0);
  const incomplete = answer.incomplete.reduce((n, v) => n + v.nodes, 0);
  report.push({
    path,
    landed: p.url().replace(BASE, ""),
    violations: count,
    rules: answer.violations,
    incomplete,
    errors: errors.length,
    failed: answer.failed,
  });
  console.log(
    `${path}: مخالفات ${count} في ${answer.violations.length} قاعدة · غير محسوم ${incomplete} · أخطاء كونسول ${errors.length}` +
      (answer.violations.length ? ` — ${answer.violations.map((v) => `${v.id}(${v.nodes})`).join(" ")}` : ""),
  );
  await ctx.close();
}

writeFileSync("scratch/a11y-admin-sweep.json", JSON.stringify(report, null, 2), "utf8");
const totalRules = new Set();
let totalNodes = 0;
let totalIncomplete = 0;
let blocked = 0;
for (const r of report) {
  if (r.violations < 0) blocked += 1;
  totalNodes += Math.max(0, r.violations);
  totalIncomplete += r.incomplete;
  for (const v of r.rules) totalRules.add(v.id);
}
console.log(
  `\nشاشات: ${report.length} · منها ما فتحش: ${blocked} · إجمالي العقد المخالفة: ${totalNodes} في ${totalRules.size} قاعدة (${[...totalRules].join("، ")}) · غير محسوم: ${totalIncomplete}`,
);
console.log("نضيف تمامًا:", report.filter((r) => r.violations === 0).map((r) => r.path).join(" ، ") || "—");
if (blocked) {
  console.log(`\nاللفة مرفوضة: ${blocked} شاشة ما فتحتش — الرقم اللي فوق مش «صفر مخالفات»، هو «ما اتقنش».`);
  process.exitCode = 1;
}
await b.close();
