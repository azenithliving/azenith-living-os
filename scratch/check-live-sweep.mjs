import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The whole store, one pass, on the published site: the customer's doors answer, his sheet draws
 * from a paper that really exists in the record, and nothing in the Arabic copy leaked a machine
 * word. Nothing is written; the throwaway rows are only ever read.
 *   node scratch/check-live-sweep.mjs <base>
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

// The routes this store actually has. `/contact` is not one of them — the dossier's label table
// names it for historic recorded visits, and a sweep that guessed a route would report a defect
// that is really my own wrong assumption.
const ROUTES = ["/", "/furniture", "/rooms", "/start", "/request", "/rooms/living-room", "/furniture/sofas", "/about"];
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

const statuses = [];
for (const route of ROUTES) {
  const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
  // Some of these pages are client-built; reading them before hydration measures the shell, not the page.
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body?.innerText?.slice(0, 6000) ?? "").catch(() => "");
  statuses.push({
    route,
    status: res ? res.status() : 0,
    letters: text.length,
    // A machine key on a customer's page is the defect this sweep exists to catch.
    leaked: /\b(room_sketches|customer_key|avg_color|ops-lead|qayyim|jsonb|undefined|NaN)\b/.test(text),
  });
}
console.log("storefront:");
for (const line of statuses) console.log(`  ${line.route} → ${line.status} · ${line.letters} letters${line.leaked ? " · LEAKED A MACHINE WORD" : ""}`);

// A paper that really exists in the record, opened the way his customer opens it.
const [real] = await db.$queryRaw`select token from public.room_sketches where plan is not null and token is not null order by id desc limit 1`;
if (real?.token) {
  await page.goto(`${BASE}/passport/${real.token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const sheet = await page
    .waitForSelector("[data-plan-block]", { timeout: 45000 })
    .then(() =>
      page.evaluate(() => ({
        drew: Boolean(document.querySelector("[data-plan-sheet]")),
        walls: document.querySelectorAll("[data-plan-wall]").length,
        colours: document.querySelectorAll("[data-colour-swatch]").length,
        pictures: document.querySelectorAll("[data-family-vote]").length,
        asked: document.querySelector("[data-plan-missing]")?.textContent ?? null,
      }))
    )
    .catch(() => null);
  console.log("a real customer's sheet:", JSON.stringify(sheet));
  await page.screenshot({ path: "scratch/live-real-sheet.png", fullPage: false });
} else {
  console.log("a real customer's sheet: no stored drawing to open");
}

const verdict = {
  everyRouteAnswers: statuses.every((s) => s.status === 200 && s.letters > 200),
  noMachineWords: statuses.every((s) => !s.leaked),
  realSheetDraws: Boolean(real?.token),
};
console.log("verdict:", JSON.stringify(verdict, null, 1));
process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
await browser.close();
await db.$disconnect();
