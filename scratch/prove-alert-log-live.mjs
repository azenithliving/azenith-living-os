import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Live proof of the alert log on the published site, at the owner's width.
 *
 * The claim being tested is one sentence: an alert recorded by one request is still there for the
 * next. On serverless that can only be proved from outside — two separate answers, and the same row
 * id in both, with its sighting count moved. The screen is then read as he reads it: the note line,
 * the alert card, whether any Latin digit or English word survived, and a screenshot.
 *
 *   node scratch/prove-alert-log-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

async function readDoor() {
  return p.evaluate(async () => {
    const res = await fetch("/api/system-health", { cache: "no-store" });
    const text = await res.text();
    try {
      return { status: res.status, json: JSON.parse(text) };
    } catch {
      return { status: res.status, json: null, raw: text.slice(0, 200) };
    }
  });
}

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
console.log(`after login at ${p.url()}`);

// Wait for the new build: the door only carries `logState` once this atom is live.
let first = null;
for (let attempt = 0; attempt < 40; attempt++) {
  first = await readDoor();
  if (first.json?.health && typeof first.json.health.logState === "string") break;
  console.log(`build not live yet (attempt ${attempt + 1}) — door has no logState`);
  await p.waitForTimeout(20000);
}
const second = (await p.waitForTimeout(4000), await readDoor());

const idsOf = (r) => (r.json?.pendingAlerts ?? []).map((a) => `${a.id}×${a.occurrences ?? 1}`);
for (const [label, r] of [["first", first], ["second", second]]) {
  const h = r.json?.health ?? {};
  console.log(`\n${label}: status=${r.status} logState=${h.logState} total=${h.metrics?.totalLogged} active=${h.metrics?.activeAlerts} api=${h.metrics?.apiSuccessRate} db=${h.metrics?.dbConnectionHealth} mem=${h.metrics?.memoryUsagePercent}`);
  console.log(`  note: ${h.logNote}`);
  console.log(`  rows: ${idsOf(r).join(", ") || "(none)"}`);
  for (const a of r.json?.pendingAlerts ?? []) {
    console.log(`  [${a.categoryAr}/${a.severity}/autoFix=${a.autoFixable}] ${a.problem}`);
    console.log(`     سبب: ${a.rootCause}`);
    console.log(`     مقترح: ${a.proposedFix}`);
    console.log(`     سجل الغلط: ${String(a.errorLog ?? "").length} حرف`);
  }
  if (!r.json) console.log(`  not JSON: ${r.raw}`);
}

const same = JSON.stringify(idsOf(first).map((x) => x.split("×")[0])) === JSON.stringify(idsOf(second).map((x) => x.split("×")[0]));
const bumped = idsOf(second).some((x) => Number(x.split("×")[1]) > Number((idsOf(first).find((y) => y.startsWith(x.split("×")[0])) ?? "×1").split("×")[1]));
console.log(`\ncross-request proof: same rows in both answers = ${same} · sighting count moved = ${bumped}`);

await p.goto(`${BASE}/admin/database`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(15000);

const screen = await p.evaluate(() => {
  const text = document.body.innerText;
  return {
    chars: text.length,
    latinDigits: (text.match(/[0-9]/g) ?? []).length,
    latinRuns: (text.match(/[A-Za-z]{2,}/g) ?? []).slice(0, 12),
    note: (text.match(/[^\n]*تنبيه[^\n]*/) ?? []).slice(0, 6),
    hasAlertCard: /رجّع فشل|وصل لـ|مش بترجّع/.test(text),
    title: document.title,
  };
});
console.log(`\nscreen: ${screen.chars} chars · title="${screen.title}" · alert card visible=${screen.hasAlertCard}`);
console.log(`  latin digits on screen = ${screen.latinDigits} · latin runs = ${screen.latinRuns.join(", ") || "none"}`);
for (const line of screen.note) console.log(`  «${line.trim()}»`);

await p.screenshot({ path: "scratch/alert-log-live-390.png", fullPage: true });
console.log(`\nconsole errors = ${errors.length}${errors.length ? `: ${errors.join(" | ")}` : ""}`);
console.log("screenshot: scratch/alert-log-live-390.png");

await b.close();
