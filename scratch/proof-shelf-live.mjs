import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import postgres from "postgres";

/**
 * Proof on his published site at his width: the shelf a visitor opens, and the desk he types into.
 *
 * Four claims, each measured where it is supposed to show:
 *   ١) a visitor with nothing on the shelf reads «قريبًا» — no empty grid, no invented card;
 *   ٢) his desk names what is missing on the row another agent left behind, and counts in his digits;
 *   ٣) a piece he types there — name, price, picture — reaches the visitor's page with the price in
 *      Arabic numerals, which is the rule flipping from refused to taken;
 *   ٤) the instrument's own row leaves with the instrument: it is deleted by name at the end and the
 *      table is counted back to what it was.
 *
 * The build marker is a string only this build can print: «قطعة بتظهر للزائر» on the desk header.
 *
 *   node scratch/proof-shelf-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const MARKER = "قطعة بتظهر للزائر";
const PROBE_NAME = "كنبة اختبار — سطر الآلة";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const before = await sql`select count(*)::int as n from products`;
const bank = await sql`select url from curated_images where url is not null and url like 'https%' limit 1`;
const cover = bank[0]?.url ?? "";
console.log(`products before=${before[0].n} · cover from his own bank: ${cover ? "yes" : "NO BANK ROW"}`);
if (!cover) {
  console.log("REFUSING: no bank picture to prove with.");
  process.exit(1);
}

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const errors = [];

// ١) the visitor, before anyone signs in
const visitor = await ctx.newPage();
visitor.on("console", (m) => m.type() === "error" && errors.push("visitor: " + m.text().slice(0, 140)));
visitor.on("pageerror", (e) => errors.push("visitor: " + String(e).slice(0, 140)));
await visitor.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await visitor.waitForTimeout(3500);
const emptyState = await visitor.locator("main").getAttribute("data-shelf-state");
const soonText = await visitor.getByText("قريبًا").count();
const cardsBefore = await visitor.locator("article").count();
const headerLinkBefore = await visitor.getByRole("link", { name: "المتجر" }).count();
await visitor.getByLabel("فتح القائمة").click();
await visitor.waitForTimeout(1200);
const headerLink = await visitor.getByRole("link", { name: "المتجر" }).count();
await visitor.screenshot({ path: "scratch/shop-empty-390.png", fullPage: true });
console.log(`visitor: state=${emptyState} «قريبًا» blocks=${soonText} cards=${cardsBefore} drawer links to المتجر=${headerLink} (closed menu showed ${headerLinkBefore})`);

// ٢) his desk
const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && errors.push("desk: " + m.text().slice(0, 140)));
p.on("pageerror", (e) => errors.push("desk: " + String(e).slice(0, 140)));
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
console.log(`signed in? url=${p.url()}`);

await p.goto(`${BASE}/admin/v2/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector(`text=${MARKER}`, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(2500);
const bodyText = (await p.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 220);
console.log(`desk landed on ${p.url()} · first words: ${bodyText}`);
const deskTitle = await p.getByText("رفّ الجاهز").count();
const menuDoor = await p.getByRole("link", { name: "رفّ الجاهز" }).count();
const missingLine = await p.getByText(/ناقص:/).count();
const arabicPicker = await p.getByText("اختار صورة من الموبايل").count();
const englishPicker = await p.getByText("Choose File").count();
console.log(`desk picker: Arabic word=${arabicPicker} browser's own English=${englishPicker}`);
await p.screenshot({ path: "scratch/shop-desk-390.png", fullPage: true });
console.log(`desk: title=${deskTitle} menu door=${menuDoor} rows naming what is missing=${missingLine}`);
if (!deskTitle || !(await p.locator("#shop-name").count())) {
  console.log("REFUSING TO TYPE: the desk did not open its own form — nothing was written to the table.");
  await b.close();
  await sql.end();
  process.exit(1);
}

// ٣) he types a piece and it reaches the visitor
await p.fill("#shop-name", PROBE_NAME);
await p.fill("#shop-price", "45000");
await p.fill("#shop-short", "سطر واحد يوصف القطعة");
await p.fill("#shop-cover-url", cover);
await p.click("button[type=submit]");
await p.waitForSelector("text=اتسجّلت", { timeout: 60000 });
const stored = await p.getByText(/اتسجّلت/).first().textContent();
await p.waitForTimeout(2500);
const nowMissing = await p.getByText(/ناقص:/).count();
const showingLine = await p.getByText(MARKER).first().textContent();
console.log(`desk after typing: ${String(stored).trim()} · rows with the price read-back=${showingLine?.trim()} · still missing=${nowMissing}`);

const rows = await sql`select id from products where name=${PROBE_NAME}`;
console.log(`counted in the table by probe name: ${rows.length}`);
if (rows.length !== 1) {
  console.log("REFUSING TO CONTINUE: the typed row is not exactly one in the table.");
  await b.close();
  await sql.end();
  process.exit(1);
}

await visitor.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await visitor.waitForTimeout(4000);
const stockedState = await visitor.locator("main").getAttribute("data-shelf-state");
const cardsAfter = await visitor.locator("article").count();
const priceText = await visitor.getByText("جنيه").first().textContent().catch(() => "");
const probeVisible = await visitor.getByText(PROBE_NAME).count();
await visitor.screenshot({ path: "scratch/shop-stocked-390.png", fullPage: true });
const latinDigits = /[0-9]/.test(String(priceText));
console.log(`visitor after typing: state=${stockedState} cards=${cardsAfter} probe on the page=${probeVisible} price read as «${String(priceText).trim()}» latin digits=${latinDigits}`);

// ٤) his reversible word: hide it, and the visitor's page goes back to «قريبًا»
await p.getByRole("button", { name: "خبّيها عن الزائر" }).first().click();
await p.waitForTimeout(3000);
await visitor.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await visitor.waitForTimeout(3500);
const hiddenState = await visitor.locator("main").getAttribute("data-shelf-state");
const hiddenCards = await visitor.locator("article").count();
console.log(`after hiding from the desk: state=${hiddenState} cards=${hiddenCards}`);

// ٥) the instrument's row leaves with the instrument
const removed = await sql`delete from products where id=${rows[0].id} and name=${PROBE_NAME} returning id`;
const after = await sql`select count(*)::int as n from products`;
console.log(`cleanup: rows removed=${removed.length} · products after=${after[0].n} (was ${before[0].n})`);

console.log(`console errors during the walk: ${errors.length}${errors.length ? " → " + errors.slice(0, 4).join(" | ") : ""}`);
await b.close();
await sql.end();

const passed =
  emptyState === "empty" && soonText === 1 && cardsBefore === 0 && headerLink >= 1 &&
  deskTitle >= 1 && menuDoor >= 1 && missingLine >= 1 && arabicPicker >= 1 && englishPicker === 0 &&
  probeVisible === 1 && stockedState === "stocked" && cardsAfter === 1 && !latinDigits &&
  hiddenState === "empty" && hiddenCards === 0 &&
  removed.length === 1 && after[0].n === before[0].n && errors.length === 0;
console.log(passed ? "PROVED" : "NOT PROVED — read the numbers above");
process.exit(passed ? 0 : 1);
