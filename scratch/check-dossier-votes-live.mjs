/**
 * Does the family's choice reach the owner's desk, on the published site?
 *   node scratch/check-dossier-votes-live.mjs [base]
 *
 * Attaches a throwaway paper to a customer who already exists in the roll, casts two votes on it
 * through the same keys the customer's page writes, signs in as the store's own admin, opens the
 * pre-call file for that customer, and reads back what the family section says and whether the
 * chosen pictures actually loaded. The throwaway paper is deleted at the end and its votes go
 * with it; his roll is never touched.
 *
 * Credentials are read from the environment and never printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import speakeasy from "speakeasy";

const BASE = process.argv[2] || "https://azenith-living.vercel.app";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const owned = await db.$queryRaw`select customer_key, company_id from public.room_sketches where customer_key is not null and company_id is not null limit 1`;
if (!owned.length) {
  console.log("FAILED no owned paper in the roll to borrow a customer key from");
  process.exit(1);
}
const key = String(owned[0].customer_key);
const companyId = String(owned[0].company_id);
const digits = key.replace(/\D/g, "");
const last4 = digits.slice(-4);

const picture = await db.$queryRaw`select id, url from public.curated_images where url is not null and is_active = true limit 1`;
const picId = Number(picture[0].id);
const picUrl = String(picture[0].url);

const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map((b) => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 62])
  .join("");

await db.$executeRaw`insert into public.room_sketches (room, ok, token, customer_key, company_id, created_at)
  values (${'صالة اختبار الأصوات'}, false, ${token}, ${key}, ${companyId}::uuid, now())`;
const paper = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(paper[0].id);
for (const voter of ["مراتي", "أحمد"]) {
  await db.$executeRaw`insert into public.family_votes (sketch_id, image_key, image_url, voter, liked)
    values (${paperId}, ${"i" + picId}, ${picUrl}, ${voter}, true)
    on conflict (sketch_id, image_key, voter) do update set liked = true`;
}
console.log(`throwaway paper id=${paperId} on an existing customer · votes cast for picture i${picId}`);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);

  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.replace(/s+/g, "").toUpperCase(), encoding: "base32" });
    const box = page.locator('input:not([type="hidden"])').last();
    await box.fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-dossier-search]", { timeout: 60000 });
  await page.fill("[data-dossier-search]", last4);
  await page.waitForTimeout(1500);
  const candidates = await page.locator("[data-dossier-pick]").count();
  await page.locator("[data-dossier-pick]").first().click();
  await page.waitForSelector('[data-dossier-section="family"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('[data-dossier-section="family"]')?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(8000);

  const read = await page.evaluate(() => {
    const section = document.querySelector('[data-dossier-section="family"]');
    const pictures = [...document.querySelectorAll("[data-dossier-picked-picture]")];
    const missing = [...document.querySelectorAll("[data-dossier-missing]")].map((n) => n.textContent?.trim() ?? "");
    return {
      text: section?.innerText?.replace(/\s+/g, " ") ?? "",
      picked: pictures.length,
      loaded: pictures.filter((n) => (n.querySelector("img")?.naturalWidth ?? 0) > 0).length,
      srcs: pictures.map((n) => (n.querySelector("img")?.currentSrc ?? "").slice(0, 40)),
      missing,
    };
  });

  console.log(`candidates found     : ${candidates}`);
  console.log(`family section       : ${read.text.slice(0, 220)}`);
  console.log(`chosen pictures shown: ${read.picked} · loaded: ${read.loaded} · ${read.srcs.join(" | ")}`);
  console.log(`still unknown        : ${read.missing.join(" | ") || "—"}`);
  await page.locator('[data-dossier-section="family"]').screenshot({ path: "scratch/dossier-votes-live.png" });
} catch (err) {
  console.log("FAILED", String(err.message || err).slice(0, 220));
} finally {
  const gone = await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  const left = await db.$queryRaw`select count(*)::int as n from public.family_votes where sketch_id = ${paperId}`;
  console.log(`throwaway paper deleted=${gone} votes left behind=${Number(left[0]?.n ?? 0)}`);
  await browser.close();
  await db.$disconnect();
}
