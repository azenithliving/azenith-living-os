import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Which screen owns which console error — measured, not assumed.
 *
 * The row proof reported «Quality metrics error» and «Error fetching notifications» while opening the
 * cockpit, but the instrument logs in by walking the gate, and the gate drops the browser on the old
 * dashboard on its way through. So the errors may belong to a screen that was never measured. This
 * signs in ONCE, saves the session, and opens every owner screen in a fresh context that starts
 * already inside the admin — one screen, one error list, no redirect mixed in.
 *
 * It also records the requests that failed outright, because a `Failed to fetch` in the console and a
 * door that answered 404 or 500 are two halves of the same sentence.
 *
 *   node scratch/census-screen-errors.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const STATE = "scratch/admin-session.json";

const SCREENS = [
  "/admin/v2/agents/ops",
  "/admin/v2/ops",
  "/admin/v2/sales",
  "/admin/v2",
  "/admin/v2/work",
  "/admin/v2/sketches",
  "/admin/v2/keys",
  "/admin/database",
  "/admin",
  "/admin/agents",
];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });

// Sign in once, keep the cookie jar.
const seed = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await seed.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await seed.waitForTimeout(4000);
await seed.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await seed.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await seed.click("button[type=submit]");
await seed.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await seed.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await seed.click("button[type=submit]");
for (let i = 0; i < 20 && !seed.url().includes("/admin"); i++) await seed.waitForTimeout(2000);
await seed.context().storageState({ path: STATE });
console.log(`دخلة واحدة، والجلسة محفوظة: ${seed.url().includes("/admin") ? "أيوه" : "لأ"}`);

for (const path of SCREENS) {
  const ctx = await b.newContext({ storageState: STATE, viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const p = await ctx.newPage();
  const errors = [];
  const bad = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 140)));
  p.on("pageerror", (e) => errors.push("استثناء: " + String(e).replace(/\s+/g, " ").slice(0, 140)));
  p.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${new URL(r.url()).pathname}`));
  // Next prefetches the links it can see as `?_rsc=` requests and cancels them on navigation. That is
  // the framework's own bookkeeping, not a fault: measured 2-9 per screen on a page with zero console
  // errors. Only an abort that is NOT a prefetch is worth his attention.
  p.on("requestfailed", (r) => {
    if (r.url().includes("_rsc=")) return;
    bad.push(`فاشل ${r.url().replace(BASE, "")} — ${(r.failure() ?? {}).errorText ?? "?"}`);
  });

  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => errors.push("ما فتحتش: " + e.message.slice(0, 80)));
  await p.waitForTimeout(14000);
  const landed = p.url().replace(BASE, "");
  console.log(`\n${path} (اتقفلت على ${landed}) · أخطاء كونسول ${errors.length} · طلب واقع ${bad.length}`);
  for (const e of [...new Set(errors)].slice(0, 5)) console.log(`   خطأ: ${e}`);
  for (const r of [...new Set(bad)].slice(0, 5)) console.log(`   طلب: ${r}`);
  await ctx.close();
}
await b.close();
writeFileSync("scratch/census-screen-errors.done", new Date().toISOString(), "utf8");
