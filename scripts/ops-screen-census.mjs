/**
 * ops-screen-census.mjs — what the owner actually sees, counted on the live site.
 *
 * The file census counts addresses; he proved six screens share one address. This
 * walks the published admin with a real browser and counts the screens that live
 * INSIDE a page: the tabs, the panels that open in place, and whether the address
 * bar moves when they do. It clicks only controls that behave like tabs — never a
 * button that runs, approves, publishes or deletes anything.
 *
 * Usage: node scripts/ops-screen-census.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const DANGER = /حذف|امسح|مسح|تنفيذ|تشغيل|إرسال|أرسل|نشر|موافق|رفض|ترحيل|إيقاف|بدء|دفع|شراء|apply|run|delete|exec/i;

const census = JSON.parse(fs.readFileSync("docs/ledger/census.json", "utf8"));
const toUrl = (id) => "/" + id.replace(/^app\//, "").replace(/\/page\.tsx$/, "").replace(/\/index$/, "");
const screens = [...new Set(
  census.atoms.filter((a) => a.kind === "old-page" || a.kind === "new-page").map((a) => toUrl(a.id)),
)];

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
// Safety at the network layer, not by judgement: while the walk clicks around, any
// request that is not a read is refused. A button that would write gets counted, and
// nothing reaches the database. The gate's own doors are the exception — logging in
// is a write, and without it there is nothing to walk.
const GATE = /\/api\/admin\/(gate\/|verify-2fa)/;
let refusedWrites = 0;
await ctx.route("**/*", (route) => {
  if (route.request().method() === "GET") return route.continue();
  if (GATE.test(new URL(route.request().url()).pathname)) return route.continue();
  refusedWrites++;
  return route.abort();
});
const p = await ctx.newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 15 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
if (!p.url().includes("/admin")) {
  console.log("LOGIN FAILED — nothing was measured");
  await b.close();
  process.exit(1);
}
console.log(`logged in through the gate, no credential printed`);

const rows = [];
for (const route of screens) {
  try {
    await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await p.waitForTimeout(2500);
  } catch {
    rows.push({ route, error: "did not open" });
    continue;
  }
  const inventory = await p.evaluate((danger) => {
    const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 46);
    const controls = [...document.querySelectorAll("button, a, [role=tab], [role=button]")];
    const labelled = controls.filter((c) => /[\u0600-\u06FF]/.test(text(c)));
    const heads = [...document.querySelectorAll("h1,h2,h3")].map(text).filter(Boolean);
    const isDanger = (el) => new RegExp(danger, "i").test(text(el));
    // These surfaces build a tab out of a plain button, so `role=tab` finds nothing.
    // A press that opens a view in place is the thing being counted, whatever the markup.
    const pressable = labelled.filter((c) => c.tagName === "BUTTON" && !isDanger(c));
    return {
      urlBefore: location.pathname,
      arabicControls: labelled.length,
      pressable: pressable.length,
      dangerCount: labelled.filter(isDanger).length,
      headings: heads.slice(0, 6),
      labels: pressable.map(text).slice(0, 14),
    };
  }, DANGER.source);

  // Press each safe control and ask the only question that matters here: did the
  // address change, and did the screen change?
  const views = [];
  const seenSets = new Set();
  for (let i = 0; i < Math.min(inventory.pressable, 14); i++) {
    const handles = await p.$$("button");
    const el = handles[i];
    if (!el) continue;
    const label = ((await el.textContent()) || "").replace(/\s+/g, " ").trim().slice(0, 46);
    if (!label || DANGER.test(label)) continue;
    const before = p.url();
    try {
      await el.click({ timeout: 3500 });
      await p.waitForTimeout(1200);
    } catch { continue; }
    const after = p.url();
    const state = await p.evaluate(() => {
      const t = (el) => (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
      return [...document.querySelectorAll("h1,h2,h3")].map(t).filter(Boolean).join("|");
    });
    const key = `${after}|${state}`;
    if (!seenSets.has(key)) {
      seenSets.add(key);
      views.push({ label, urlChanged: before !== after, headings: state.slice(0, 90) });
    }
    await p.keyboard.press("Escape");
    if (after !== before) {
      await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await p.waitForTimeout(1500);
    }
  }
  const distinct = new Set(views.map((v) => v.headings)).size;
  rows.push({ route, ...inventory, pressed: Math.min(inventory.pressable, 14), views: views.length, distinctStates: distinct, sameUrl: views.filter((v) => !v.urlChanged).length, detail: views });
  const v = rows[rows.length - 1];
  console.log(`${route.padEnd(32)} controls=${String(v.arabicControls ?? 0).padStart(3)} pressed=${String(v.pressed ?? 0).padStart(2)} views=${String(v.views ?? 0).padStart(2)} same-url=${String(v.sameUrl ?? 0).padStart(2)}`);
}

fs.mkdirSync("docs/ledger", { recursive: true });
fs.writeFileSync("docs/ledger/screens.json", JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, rows }, null, 2), "utf8");

const sum = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
console.log(`\nscreens walked: ${rows.filter((r) => !r.error).length} of ${screens.length}`);
console.log(`arabic-labelled controls found live: ${sum("arabicControls")}`);
console.log(`safe ones pressed: ${sum("pressed")}`);
console.log(`views they opened: ${sum("views")}  of them with an unchanged address: ${sum("sameUrl")}`);
console.log(`distinct states seen: ${sum("distinctStates")}`);
console.log(`requests the walk refused because they were not reads: ${refusedWrites}`);
console.log(`wrote docs/ledger/screens.json`);
await b.close();
