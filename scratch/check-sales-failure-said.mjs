import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * The sales roll says out loud when its door refuses — measured with a forced refusal.
 *   node scratch/check-sales-failure-said.mjs [base]
 *
 * Three states, in order: the door answers (no warning), the door is cut off (the warning appears
 * with its own words), the door returns (the warning goes away). A screen that only looks right when
 * the data is good has never been proven.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";

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

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

const read = () =>
  p.evaluate(() => ({
    warning: document.querySelector("[data-leads-error]")?.textContent?.trim().slice(0, 120) ?? null,
    tally: document.querySelector("[data-taste-tally]")?.textContent?.trim().replace(/\s+/g, " ").slice(0, 140) ?? null,
    cards: document.querySelectorAll("[data-lead-card]").length,
    total: document.body.innerText.match(/العملاء المحتملين/)?.[0] ?? "",
  }));

const good = await read();
console.log(`١) الباب بردّ: تحذير=${good.warning ? "موجود" : "مفيش"} · سطر الطرازات=${good.tally ? `«${good.tally}»` : "مفيش"}`);

await p.route("**/api/admin/leads", (route) => route.abort());
await p.waitForTimeout(7000);
const cut = await read();
console.log(`٢) الباب اتقطع: تحذير=${cut.warning ? `«${cut.warning}»` : "مفيش — ده الفشل"}`);
await p.screenshot({ path: "scratch/sales-failure-said.png" });

await p.unroute("**/api/admin/leads");
await p.waitForTimeout(8000);
const back = await read();
console.log(`٣) الباب رجع: تحذير=${back.warning ? "لسه موجود" : "اختفى"}`);
console.log(`\n   أخطاء الكونسول (غير المقطوع المتعمّد): ${errors.length ? [...new Set(errors)].slice(0, 3).join(" | ") : "صفر"}`);
await b.close();
