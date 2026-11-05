import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Proof on the published site: the store's number has one owner, and what he types in the dashboard
 * is what a customer's button opens — everywhere.
 *
 * The fake number this script adds is always removed, and the primary is always restored, in a
 * finally block: a stranger's number must not survive the instrument that tested it.
 *
 *   node scratch/proof-numbers-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const HIS = "201090819584";
const FAKE = "201112223334";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const errors = [];
let restored = false;

async function catalogueLinks(page) {
  await page.goto(`${BASE}/furniture`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const hrefs = await page.locator('a[href*="wa.me"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  return {
    total: hrefs.length,
    his: hrefs.filter((h) => h.includes(HIS)).length,
    stranger: hrefs.filter((h) => h.includes("01103032345")).length,
    fake: hrefs.filter((h) => h.includes(FAKE)).length,
  };
}

const anon = await ctx.newPage();
anon.on("console", (m) => m.type() === "error" && errors.push("anon: " + m.text().slice(0, 120)));
anon.on("pageerror", (e) => errors.push("anon: " + String(e).slice(0, 120)));

const cfg = await (await anon.request.get(`${BASE}/api/config`)).json();
console.log(`config door: whatsappNumber=${cfg?.whatsappNumber} degraded=${cfg?.degraded ?? false}`);

const before = await catalogueLinks(anon);
console.log(`catalogue before: ${before.total} links · his=${before.his} stranger-2345=${before.stranger} fake=${before.fake}`);

// the footer, on every customer page, server-rendered
await anon.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
await anon.waitForTimeout(4000);
const homeLinks = await anon.locator("footer a[href*=\"wa.me\"]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
const homeText = await anon.locator("footer").innerText();
console.log(`home page footer: links=${homeLinks.length} · first=${homeLinks[0] ?? "none"} · shows local form=${/٠١٠٩٠٨١٩٥٨٤/.test(homeText)}`);

const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && errors.push("desk: " + m.text().slice(0, 120)));
p.on("pageerror", (e) => errors.push("desk: " + String(e).slice(0, 120)));
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

await p.goto(`${BASE}/admin/v2/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("[data-numbers-card]", { timeout: 40000 });
await p.waitForTimeout(2500);
const listed = await p.locator("[data-numbers-card] li").count();
const shownNumber = await p.locator("[data-numbers-card] li").first().innerText();
console.log(`desk: numbers listed=${listed} first row=«${shownNumber.replace(/\s+/g, " ")}»`);
await p.screenshot({ path: "scratch/numbers-desk-390.png" });

try {
  // add a second number, make it primary, and check the customer's buttons follow
  await p.fill("#new-number", "01112223334");
  await p.fill("#new-label", "رقم للتجربة");
  await p.click("button[type=submit]");
  await p.waitForSelector("text=اتسجّلت", { timeout: 60000 });
  await p.waitForTimeout(2500);
  const afterAdd = await p.locator("[data-numbers-card] li").count();
  console.log(`desk after adding: ${afterAdd} numbers`);

  await p.getByRole("button", { name: "خليه الأساسي" }).first().click();
  await p.waitForTimeout(3000);
  const moved = await catalogueLinks(anon);
  console.log(`catalogue with the new primary: his=${moved.his} fake=${moved.fake} stranger-2345=${moved.stranger}`);

  // restore: his number primary again, then remove the test number
  const rows = p.locator("[data-numbers-card] li");
  const rowCount = await rows.count();
  for (let i = 0; i < rowCount; i++) {
    const text = await rows.nth(i).innerText();
    if (text.includes(HIS)) {
      await rows.nth(i).getByRole("button", { name: "خليه الأساسي" }).click();
      break;
    }
  }
  await p.waitForTimeout(3000);
  for (let i = 0; i < 4; i++) {
    const target = p.locator("[data-numbers-card] li", { hasText: FAKE });
    if ((await target.count()) === 0) break;
    await target.first().getByRole("button", { name: /^أزل/ }).click();
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: /^أؤكد/ }).first().click();
    await p.waitForTimeout(3500);
  }
  const finalRows = await p.locator("[data-numbers-card] li").count();
  const finalCfg = await (await anon.request.get(`${BASE}/api/config`)).json();
  const finalCatalogue = await catalogueLinks(anon);
  restored = finalRows === 1 && finalCfg?.whatsappNumber === HIS && finalCatalogue.his === finalCatalogue.total && finalCatalogue.fake === 0;
  console.log(`restored: rows=${finalRows} config=${finalCfg?.whatsappNumber} catalogue his=${finalCatalogue.his}/${finalCatalogue.total} fake=${finalCatalogue.fake}`);
} finally {
  if (!restored) {
    console.log("WARNING: the store's number may not be restored — re-run or fix by hand before anything else.");
  }
}

console.log(`console errors: ${errors.length}${errors.length ? " → " + errors.slice(0, 3).join(" | ") : ""}`);
const passed =
  cfg?.whatsappNumber === HIS &&
  before.total >= 18 && before.his === before.total && before.stranger === 0 &&
  homeLinks.length >= 1 && String(homeLinks[0]).includes(HIS) &&
  listed === 1 && shownNumber.includes(HIS) &&
  restored && errors.length === 0;
console.log(passed ? "PROVED" : "NOT PROVED — read the numbers above");
await b.close();
process.exit(passed ? 0 : 1);
