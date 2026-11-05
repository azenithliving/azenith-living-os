/**
 * Does the contact moment actually capture a stranger, on a phone?
 *   node scratch/check-contact-offer.mjs [base]
 *
 * Raises a throwaway paper with its own secret address, opens it at 390px, types a mobile,
 * an area and a room type, presses the offer, and reads back three things: the pictures the
 * bank really returned (loaded, not merely linked), what the table now holds for that paper,
 * and what the sheet shows after a reload. The throwaway paper is deleted at the end, so his
 * roll is left exactly as found.
 *
 * Credentials are read from the environment and never printed.
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
  .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
  .join("");
const PHONE = "0100 999 8877";
const CITY = "التجمع الخامس";

await db.$executeRaw`insert into public.room_sketches (room, ok, token, created_at) values (null, false, ${token}, now())`;
const paper = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(paper[0].id);
console.log(`throwaway paper id=${paperId}`);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();

try {
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("[data-contact-offer]", { timeout: 60000 });

  const before = await page.evaluate(() => ({
    chips: document.querySelectorAll("[data-contact-room]").length,
    hasPhoneField: !!document.querySelector("[data-contact-phone]"),
    copy: document.querySelector("[data-contact-offer]")?.innerText.replace(/\s+/g, " ").slice(0, 150),
  }));
  console.log(`offer block             : chips=${before.chips} phone=${before.hasPhoneField}`);
  console.log(`what it says            : ${before.copy}`);

  // Probed while the paper is still unclaimed: a half-typed number must be refused in his
  // words, not stored as a phantom customer in the roll.
  const refused = await page.evaluate(async (t) => {
    const r = await fetch(`/api/passport/${t}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "12345", city: "؟" }),
    });
    return { status: r.status, body: (await r.json().catch(() => ({})))?.error ?? "" };
  }, token);
  console.log(`bad number, unclaimed   : ${refused.status} · ${refused.body}`);

  await page.fill("[data-contact-phone]", PHONE);
  await page.fill("[data-contact-city]", CITY);
  await page.locator('[data-contact-room="master-bedroom"]').click();
  await page.screenshot({ path: "scratch/contact-before.png" });

  await page.locator("[data-contact-offer] button:has-text('ابعتلي الاقتراحات')").click();
  await page.waitForSelector("[data-contact-sent]", { timeout: 60000 });
  await page.waitForTimeout(6000);

  const after = await page.evaluate(() => {
    const pics = [...document.querySelectorAll("[data-offer-picture]")];
    const share = document.querySelector("[data-contact-share]");
    return {
      line: document.querySelector("[data-contact-sent] h2")?.innerText.trim(),
      shown: pics.length,
      loaded: pics.filter((n) => n.naturalWidth > 0).length,
      shareHref: share ? String(share.getAttribute("href")).slice(0, 60) : "",
      shareText: share ? share.innerText.replace(/\s+/g, " ").trim() : "",
    };
  });
  console.log(`the line he reads       : ${after.line}`);
  console.log(`pictures                : shown=${after.shown} loaded=${after.loaded}`);
  console.log(`whatsapp door           : ${after.shareText} · ${after.shareHref}`);
  await page.screenshot({ path: "scratch/contact-after.png" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const reload = await page.evaluate(() => ({
    claimed: !!document.querySelector("[data-contact-claimed]"),
    askedAgain: !!document.querySelector("[data-contact-phone]"),
    claimedText: document.querySelector("[data-contact-claimed]")?.innerText.replace(/\s+/g, " ").slice(0, 130),
  }));
  console.log(`after a reload          : claimed=${reload.claimed} asksNumberAgain=${reload.askedAgain}`);
  console.log(`what the claimed card   : ${reload.claimedText}`);

  const stored = await db.$queryRaw`select customer_key, customer_city, room from public.room_sketches where id = ${paperId}`;
  console.log(`what the table holds    : ${JSON.stringify(stored[0])}`);

} catch (err) {
  console.log("FAILED", String(err.message || err).slice(0, 240));
} finally {
  const gone = await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  const left = await db.$queryRaw`select count(*)::int n from public.room_sketches where token = ${token}`;
  console.log(`throwaway deleted=${gone} rows left=${Number(left[0].n)}`);
  await browser.close();
  await db.$disconnect();
}
