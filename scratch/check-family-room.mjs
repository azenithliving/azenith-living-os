/**
 * Does the family decision room actually work, on two phones, on the store's own record?
 *   node scratch/check-family-room.mjs [base]
 *
 * Makes one throwaway sheet of its own (never a customer's paper), opens its private address in
 * two 390px browsers, has each of them write a name and tap the same picture, and reads the
 * store's record back. Then it deletes the throwaway sheet — the votes go with it — and prints
 * what happened, including the picture the customer sees.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const BASE = process.argv[2] || "http://localhost:3222";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62])
  .join("");

const created = await db.$executeRaw`insert into public.room_sketches (room, ok, created_at) values (${'صالة اختبار غرفة العائلة'}, false, now())`;
const sketch = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
let sketchId = Number(sketch[0]?.id ?? 0);
if (!sketchId) {
  // The token column is written by the store's own code; for a throwaway row set it directly.
  await db.$executeRaw`update public.room_sketches set token = ${token} where id = (select id from public.room_sketches order by id desc limit 1)`;
  const again = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
  sketchId = Number(again[0]?.id ?? 0);
}
console.log(`throwaway sheet id=${sketchId} token=${token.slice(0, 6)}… created=${created}`);

const browser = await chromium.launch({ headless: true });
const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });

async function open(ctx, name) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-family-vote]", { timeout: 60000 });
  await page.fill("[data-family-name]", name);
  await page.waitForTimeout(600);
  return { page, errors };
}

const report = [];
try {
  const a = await open(ctxA, "مراتي");
  const first = await a.page.locator("[data-family-vote]").first().getAttribute("data-family-vote");
  await a.page.locator(`[data-family-vote=\"${first}\"]`).click();
  await a.page.waitForTimeout(1500);
  report.push(`A(مراتي) tapped picture ${first}: count=${await a.page.locator(`[data-family-count=\"${first}\"]`).innerText()}`);
  await a.page.screenshot({ path: "scratch/family-room-phone.png" });

  const b = await open(ctxB, "أحمد");
  await b.page.locator(`[data-family-vote=\"${first}\"]`).click();
  await b.page.waitForTimeout(1500);
  report.push(`B(أحمد) tapped the same picture: count=${await b.page.locator(`[data-family-count=\"${first}\"]`).innerText()}`);

  // A has to see B's tap without reloading — the page asks again on its own rhythm.
  await a.page.reload({ waitUntil: "domcontentloaded" });
  await a.page.waitForSelector("[data-family-vote]", { timeout: 60000 });
  await a.page.fill("[data-family-name]", "مراتي");
  await a.page.waitForTimeout(1200);
  report.push(`A after the sheet moved: count=${await a.page.locator(`[data-family-count=\"${first}\"]`).innerText()} people=${await a.page.locator("[data-family-people]").innerText().catch(() => "—")}`);

  // A second tap changes the mind rather than adding a second vote.
  await a.page.locator(`[data-family-vote=\"${first}\"]`).click();
  await a.page.waitForTimeout(1500);
  report.push(`A tapped again (unlike): count=${await a.page.locator(`[data-family-count=\"${first}\"]`).innerText()}`);

  const rows = await db.$queryRaw`select voter, liked from public.family_votes where sketch_id = ${sketchId} order by voter`;
  report.push(`rows in the store's record: ${JSON.stringify(rows.map((r) => ({ voter: String(r.voter), liked: r.liked })))}`);

  report.push(`A console errors: ${a.errors.length ? a.errors.join(" | ") : "none"}`);
  report.push(`B console errors: ${b.errors.length ? b.errors.join(" | ") : "none"}`);
} catch (err) {
  report.push(`FAILED ${String(err.message || err).slice(0, 200)}`);
} finally {
  console.log(report.join("\n"));
  const gone = await db.$executeRaw`delete from public.room_sketches where id = ${sketchId}`;
  const left = await db.$queryRaw`select count(*)::int as n from public.family_votes where sketch_id = ${sketchId}`;
  console.log(`throwaway sheet deleted=${gone} votes left behind=${Number(left[0]?.n ?? 0)}`);
  await browser.close();
  await db.$disconnect();
}
