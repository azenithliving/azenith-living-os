/**
 * Does the owner's pre-call file show the same room his customer sees?
 *   node scratch/check-dossier-plan.mjs [base]
 *
 * Takes one real roll customer (his own number, as the store already keys him), files a throwaway
 * paper with two numbers under his link, opens the golden file at 390px, and reads back what the
 * drawing says. The throwaway paper is deleted at the end; the roll is left exactly as found.
 *
 * Credentials are read from the environment and never printed.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";


const BASE = process.argv[2] || "http://localhost:3223";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const [who] = await db.$queryRaw`select phone from public.leads where phone is not null and length(regexp_replace(phone, '[^0-9]', '', 'g')) >= 10 limit 1`;
if (!who?.phone) {
  console.error("مفيش عميل في الدفتر");
  process.exit(1);
}
// The last four digits are what the file's own search asks for; the key is read back off the row
// the roll offers, so this instrument can't disagree with the store about who a number is.
const tail = String(who.phone).replace(/\D/g, "").slice(-4);

let paperId = null;
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  // The gate's own button stays disabled until its React state sees the fields: filling before
  // hydration leaves it dead and the form submits to nothing.
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]')?.disabled, null, { timeout: 30000 });
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  if ((await page.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
    const { default: speakeasy } = await import("speakeasy");
      const code = speakeasy.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" });
    await page.locator('input:not([type="hidden"])').last().fill(code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }

  await page.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  try {
    await page.waitForSelector("[data-dossier-search]", { timeout: 20000 });
  } catch {
    await page.screenshot({ path: "scratch/dossier-plan-missing.png", fullPage: true });
    console.error(
      "no dossier search box. url=" + page.url() + " text=" + (await page.evaluate(() => document.body.innerText.slice(0, 400)))
    );
    process.exit(1);
  }
  await page.fill("[data-dossier-search]", tail);
  await page.waitForTimeout(2000);
  const offered = await page.evaluate(() => [...document.querySelectorAll("[data-dossier-pick]")].map((b) => b.getAttribute("data-dossier-pick")));
  const key = offered.find((k) => k?.startsWith("phone:"));
  if (!key) {
    console.error(`the roll offered nobody for the last four digits. offered=${JSON.stringify(offered)}`);
    process.exit(1);
  }

  // Now that the roll has said who this is, file a throwaway paper under his own link.
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
    .join("");
  const dimensions = [
    { label: "الطول", meters: 5.2, confirmed: true },
    { label: "العرض", meters: 4.1, confirmed: false },
  ];
  // The file only reads papers filed under this store, so the throwaway row carries the same
  // company the owner's own desk resolves — otherwise the honest answer is «مفيش ورقة».
  const [company] = await db.$queryRaw`select company_id from public.room_sketches where company_id is not null limit 1`;
  await db.$executeRaw`insert into public.room_sketches (room, ok, token, customer_key, company_id, dimensions, openings, created_at)
    values (${"مجلس رجال"}, true, ${token}, ${key}, ${company?.company_id ?? null}::uuid, ${JSON.stringify(dimensions)}::jsonb, ${JSON.stringify([{ kind: "window", widthMeters: 1.6 }])}::jsonb, now())`;
  const [paper] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
  paperId = Number(paper.id);
  console.log(`throwaway paper filed under the roll's own link: id=${paperId}`);

  await page.locator(`[data-dossier-pick="${key}"]`).click();
  await page.waitForSelector("[data-dossier-file]", { timeout: 45000 });
  // The file is assembled from four spaces; sampling it while it still says «قرايم» measures nothing.
  await page.waitForSelector("[data-dossier-section='paper']", { timeout: 60000 });
  await page.waitForSelector("[data-dossier-plan]", { timeout: 60000 });

  const seen = await page.evaluate(() => {
    const walls = [...document.querySelectorAll("[data-dossier-plan] [data-plan-wall]")];
    return {
      hasPlan: Boolean(document.querySelector("[data-dossier-plan]")),
      walls: walls.length,
      solid: walls.filter((w) => w.getAttribute("data-plan-wall-confirmed") === "1").length,
      dashed: walls.filter((w) => w.getAttribute("data-plan-wall-confirmed") === "0").length,
      handle: document.querySelectorAll("[data-dossier-plan] [data-plan-handle]").length,
      shapeFact: [...document.querySelectorAll("[data-dossier-section='paper'] li")].find((li) => li.textContent?.includes("شكل المكان"))?.textContent ?? null,
      areaFact: [...document.querySelectorAll("[data-dossier-section='paper'] li")].find((li) => li.textContent?.includes("المساحة"))?.textContent ?? null,
      interactive: Boolean(document.querySelector("[data-dossier-plan] [role='slider']")),
    };
  });
  console.log("the owner's file:", JSON.stringify(seen, null, 1));
  await page.screenshot({ path: "scratch/dossier-plan.png", fullPage: true });
  console.log("file text:", await page.evaluate(() => document.querySelector("[data-dossier-file]")?.innerText.slice(0, 700)));
  console.log("sections:", await page.evaluate(() => [...document.querySelectorAll("[data-dossier-section]")].map((s) => s.getAttribute("data-dossier-section"))));

  const verdict = {
    drew: seen.hasPlan && seen.walls === 4,
    witnesses: seen.solid === 2 && seen.dashed === 2,
    readOnly: seen.handle === 0 && !seen.interactive,
    shapeNamed: Boolean(seen.shapeFact?.includes("مستطيل")),
    areaMeasured: Boolean(seen.areaFact?.includes("٢١٫٣")),
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  if (paperId) await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await browser.close();
  await db.$disconnect();
}
