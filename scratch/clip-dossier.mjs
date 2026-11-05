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
const [who] = await db.$queryRaw`select phone from public.leads where phone is not null limit 1`;
const tail = String(who.phone).replace(/\D/g, "").slice(-4);
const b = await chromium.launch({ headless: true });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let paperId = null;
try {
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
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
  await page.waitForSelector("[data-dossier-search]", { timeout: 60000 });
  await page.fill("[data-dossier-search]", tail);
  await page.waitForTimeout(2000);
  const key = await page.evaluate(() => [...document.querySelectorAll("[data-dossier-pick]")].map((x) => x.getAttribute("data-dossier-pick")).find((k) => k?.startsWith("phone:")));
  const [company] = await db.$queryRaw`select company_id from public.room_sketches where company_id is not null limit 1`;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
  const dims = [{ label: "الطول", meters: 5.2, confirmed: true }, { label: "العرض", meters: 4.1, confirmed: false }];
  await db.$executeRaw`insert into public.room_sketches (room, ok, token, customer_key, company_id, dimensions, openings, created_at)
    values (${"مجلس رجال"}, true, ${token}, ${key}, ${company.company_id}::uuid, ${JSON.stringify(dims)}::jsonb, ${JSON.stringify([{ kind: "window", widthMeters: 1.6 }])}::jsonb, now())`;
  const [p] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
  paperId = Number(p.id);
  await page.locator(`[data-dossier-pick="${key}"]`).click();
  await page.waitForSelector("[data-dossier-plan]", { timeout: 90000 });
  await page.locator("[data-dossier-plan]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.locator("[data-dossier-plan]").screenshot({ path: "scratch/dossier-plan-live.png" });
  console.log("clipped", paperId);
} finally {
  if (paperId) await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await b.close();
  await db.$disconnect();
}
