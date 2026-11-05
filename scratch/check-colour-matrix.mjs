import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Does a customer's colour choice reach the store, re-order his pictures, and arrive on the
 * owner's file — on a real phone width?
 *   node scratch/check-colour-matrix.mjs [base]
 *
 * Raises a throwaway paper for a room the bank really holds, taps swatches on his sheet, reloads,
 * then files the same paper under a roll customer's own link and reads the owner's pre-call file.
 * The throwaway rows are deleted at the end.
 *
 * Credentials are read from the environment and never printed.
 */
const BASE = process.argv[2] || "http://localhost:3223";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
  .join("");
const dimensions = [
  { label: "الطول", meters: 4.5, confirmed: true },
  { label: "العرض", meters: 3.2, confirmed: true },
];
const [company] = await db.$queryRaw`select company_id from public.room_sketches where company_id is not null limit 1`;
await db.$executeRaw`insert into public.room_sketches (room, ok, token, company_id, dimensions, openings, confirmed_at, created_at)
  values (${"صالة معيشة"}, true, ${token}, ${company.company_id}::uuid, ${JSON.stringify(dimensions)}::jsonb, ${JSON.stringify([])}::jsonb, now(), now())`;
const [paper] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(paper.id);
// Deterministic, and the key is read off the roll's own answer: the store keeps this number as
// «+20 100 234 5678», and the roll's rule for who a number is belongs to the roll, not to me.
const [lead] = await db.$queryRaw`select phone from public.leads where phone is not null order by id limit 1`;
if (!lead?.phone) {
  await db.$disconnect();
  throw new Error("مفيش عميل في الدفتر");
}
const tail = String(lead.phone).replace(/\D/g, "").slice(-4);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const colourAnswers = [];
page.on("response", (res) => {
  if (res.url().includes("/colours")) colourAnswers.push(res.status());
});

const readMatrix = () =>
  page.evaluate(() => {
    const swatches = [...document.querySelectorAll("[data-colour-swatch]")];
    return {
      offered: swatches.length,
      selected: swatches.filter((s) => s.getAttribute("data-colour-selected") === "1").length,
      hexes: swatches.map((s) => s.getAttribute("data-colour-swatch")),
      labels: swatches.map((s) => s.textContent?.replace(/\s+/g, " ").trim()),
      hint: document.querySelector("[data-colour-hint]")?.textContent ?? null,
      empty: document.querySelector("[data-colour-empty]")?.textContent ?? null,
      near: document.querySelectorAll("[data-picture-near]").length,
      firstPicture: document.querySelector("[data-family-vote]")?.getAttribute("data-family-vote") ?? null,
    };
  });

let keyForOwner = "";
try {
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("[data-colour-matrix]", { timeout: 60000 });
  const before = await readMatrix();
  console.log("offered to him:", JSON.stringify({ offered: before.offered, selected: before.selected, labels: before.labels, hint: before.hint }, null, 1));

  // 1. he stops on one colour.
  const first = page.locator("[data-colour-swatch]").first();
  const chosenHex = await first.getAttribute("data-colour-swatch");
  await first.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-colour-swatch][data-colour-selected="1"]').length > 0, null, { timeout: 30000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-colour-matrix]", { timeout: 60000 });
  const afterOne = await readMatrix();
  const stored = await db.$queryRaw`select colour_picks from public.room_sketches where id = ${paperId}`;
  await page.locator("[data-colour-block]").screenshot({ path: "scratch/colours-customer.png" });
  const picks = typeof stored[0].colour_picks === "string" ? JSON.parse(stored[0].colour_picks) : stored[0].colour_picks;
  console.log("after one tap:", JSON.stringify({ selected: afterOne.selected, near: afterOne.near }, null, 1));
  console.log("the table holds:", JSON.stringify(picks));

  // 2. a fourth colour is refused, in words he reads.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const swatches = page.locator("[data-colour-swatch]");
  const swatchCount = await swatches.count();
  let stoppedAt = 0;
  for (let i = 1; i < Math.min(5, swatchCount); i++) {
    // A fourth colour is not clickable at all — that is the refusal, and Playwright will not
    // force past it, so the loop reads the control instead of fighting it.
    if (await swatches.nth(i).isDisabled()) {
      stoppedAt = i;
      break;
    }
    await swatches.nth(i).click();
    await page.waitForTimeout(1800);
  }
  const overflow = await page.evaluate(() => ({
    full: document.querySelector("[data-colour-matrix]")?.getAttribute("data-colour-full"),
    hint: document.querySelector("[data-colour-hint]")?.textContent ?? null,
    unselectedDisabled: [...document.querySelectorAll("[data-colour-swatch]")].filter(
      (s) => s.getAttribute("data-colour-selected") === "0" && s.disabled
    ).length,
  }));
  const storedAfterFour = await db.$queryRaw`select colour_picks from public.room_sketches where id = ${paperId}`;
  const picksAfter = typeof storedAfterFour[0].colour_picks === "string" ? JSON.parse(storedAfterFour[0].colour_picks) : storedAfterFour[0].colour_picks;
  console.log("after tapping four:", JSON.stringify({ answers: colourAnswers, keptInTable: (picksAfter ?? []).length, stoppedAt, saidThree: overflow }, null, 1));

  // 3. the owner's file, for the same paper under a real roll link.
  const digits = String(lead.phone).replace(/\D/g, "");
  await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[type="email"]', { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
  await page.waitForFunction(
    () => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button) && !button.disabled;
    },
    null,
    { timeout: 30000 }
  );
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
  // Prove the session before blaming the search: without a cookie the roll door answers 401 and the
  // candidate list is empty for a reason that has nothing to do with colours.
  const rollAnswer = await page.evaluate(async () => {
    const res = await fetch("/api/admin/customers", { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, customers: Array.isArray(body?.customers) ? body.customers.length : null };
  });
  console.log("the roll door answers:", JSON.stringify(rollAnswer));
  try {
    await page.waitForSelector("[data-dossier-search]", { timeout: 45000 });
  } catch {
    console.error("no dossier box. url=" + page.url() + " text=" + (await page.evaluate(() => document.body.innerText.slice(0, 240))));
    throw new Error("the owner's screen did not open");
  }
  await page.fill("[data-dossier-search]", tail);
  // The file assembles the roll, his papers and the bank; on the published site that is not a
  // two-second answer, so wait for the candidate instead of concluding nobody exists.
  await page.waitForSelector("[data-dossier-pick]", { timeout: 30000 });
  keyForOwner = await page.evaluate(() => [...document.querySelectorAll("[data-dossier-pick]")].map((b) => b.getAttribute("data-dossier-pick")).find((k) => k?.startsWith("phone:")) ?? "");
  if (!keyForOwner) throw new Error("the roll offered nobody for this lead");
  await db.$executeRaw`update public.room_sketches set customer_key = ${keyForOwner} where id = ${paperId}`;
  await page.locator(`[data-dossier-pick="${keyForOwner}"]`).click();
  await page.waitForSelector("[data-dossier-colours]", { timeout: 90000 });
  const ownerSees = await page.evaluate(() => ({
    heading: document.querySelector("[data-dossier-colours]")?.innerText?.replace(/\s+/g, " ").trim() ?? null,
    hexes: [...document.querySelectorAll("[data-dossier-chosen-colour]")].map((s) => s.getAttribute("data-dossier-chosen-colour")),
  }));
  await page.locator("[data-dossier-colours]").screenshot({ path: "scratch/colours-owner.png" });
  console.log("the owner's file:", JSON.stringify(ownerSees, null, 1));

  const verdict = {
    offeredRealColours: before.offered >= 2 && before.hexes.every((h) => /^#[\da-f]{6}$/i.test(String(h))),
    arabicLabels: before.labels.every((l) => /\p{Script=Arabic}/u.test(String(l)) && !/[A-Za-z]{2,}/.test(String(l))),
    stored: Array.isArray(picks) && picks.length === 1 && String(picks[0].hex).toLowerCase() === String(chosenHex).toLowerCase(),
    reRanked: afterOne.near >= 1,
    fourthRefused: overflow.full === "1" && overflow.unselectedDisabled >= 1 && String(overflow.hint).includes("تلاتة") && (picksAfter ?? []).length <= 3,
    ownerSeesHisColours: ownerSees.hexes.length === (picksAfter ?? []).length && ownerSees.heading?.includes("ألوانه اللي اختارها"),
  };
  console.log("verdict:", JSON.stringify(verdict, null, 1));
  console.log("screenshots: scratch/colours-owner.png");
  process.exitCode = Object.values(verdict).every(Boolean) ? 0 : 1;
} finally {
  await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await browser.close();
  await db.$disconnect();
}
