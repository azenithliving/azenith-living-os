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
const token = Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const dims = [{ label: "الطول", meters: 4.5, confirmed: true }, { label: "العرض", meters: 3.2, confirmed: true }];
await db.$executeRaw`insert into public.room_sketches (room, ok, token, dimensions, openings, created_at)
  values (${"صالة معيشة"}, true, ${token}, ${JSON.stringify(dims)}::jsonb, ${JSON.stringify([{ kind: "door", widthMeters: 0.9 }, { kind: "window", widthMeters: 1.4 }])}::jsonb, now())`;
const [p] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(p.id);
const b = await chromium.launch({ headless: true });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
try {
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-plan-sheet]", { timeout: 60000 });
  await page.locator("[data-plan-block]").screenshot({ path: "scratch/plan-customer-before.png" });
  const handle = page.locator("[data-plan-handle='0']");
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-plan-sheet]", { timeout: 60000 });
  await page.locator("[data-plan-block]").screenshot({ path: "scratch/plan-customer-after.png" });
  const stored = await db.$queryRaw`select plan, area_sqm from public.room_sketches where id = ${paperId}`;
  const plan = typeof stored[0].plan === "string" ? JSON.parse(stored[0].plan) : stored[0].plan;
  console.log("openings after the drag:", JSON.stringify(plan?.openings?.map((o) => `${o.kind}@${o.wallIndex}:${o.offsetMeters}`)), "area:", String(stored[0].area_sqm));
} finally {
  await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await b.close();
  await db.$disconnect();
}
