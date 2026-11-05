import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Where does a door stop moving on the published site: the finger, or the page?
 *   node scratch/probe-drag-live.mjs <base>
 *
 * Raises a throwaway paper with a door, then presses the same opening two ways: at the screen
 * coordinates the handle reports, and by dispatching pointer events straight at the element. The
 * first is what a thumb does; the second is what the page would do if the geometry were fine and
 * only the aim was wrong.
 */
const BASE = process.argv[2];
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
  .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36])
  .join("");
const dims = [
  { label: "الطول", meters: 4.5, confirmed: true },
  { label: "العرض", meters: 3.2, confirmed: true },
];
await db.$executeRaw`insert into public.room_sketches (room, ok, token, dimensions, openings, confirmed_at, created_at)
  values (${"صالة"}, true, ${token}, ${JSON.stringify(dims)}::jsonb, ${JSON.stringify([{ kind: "door", widthMeters: 0.9 }])}::jsonb, now(), now())`;
const [row] = await db.$queryRaw`select id from public.room_sketches where token = ${token}`;
const paperId = Number(row.id);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const seen = [];
page.on("request", (r) => { if (r.url().includes("/plan")) seen.push(r.method() + " " + r.url().slice(-24)); });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 160)); });
page.on("pageerror", (e) => console.log("page error:", String(e.message).slice(0, 160)));

try {
  await page.goto(`${BASE}/passport/${token}`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("[data-plan-handle='0']", { timeout: 60000 });
  const info = await page.evaluate(() => {
    const handle = document.querySelector("[data-plan-handle='0']");
    const box = handle.getBoundingClientRect();
    const svg = document.querySelector("[data-plan-sheet]").getBoundingClientRect();
    const at = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      handleBox: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
      svgBox: { x: Math.round(svg.x), y: Math.round(svg.y), w: Math.round(svg.width), h: Math.round(svg.height) },
      hitTag: at ? at.tagName + "." + String(at.getAttribute("class") ?? "").slice(0, 30) : null,
      hitInGroup: at ? Boolean(at.closest("g[role='slider']")) : false,
      offset: handle.closest("g")?.getAttribute("data-plan-opening-offset"),
    };
  });
  console.log("the door on screen:", JSON.stringify(info, null, 1));

  // 1. a press at the reported coordinates.
  await page.mouse.move(info.handleBox.x + info.handleBox.w / 2, info.handleBox.y + info.handleBox.h / 2);
  await page.mouse.down();
  await page.mouse.move(info.handleBox.x + info.handleBox.w / 2 - 60, info.handleBox.y + info.handleBox.h / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  console.log("after a coordinate press, requests seen:", JSON.stringify(seen));
  console.log("offset now:", await page.evaluate(() => document.querySelector("[data-plan-opening^='door']")?.getAttribute("data-plan-opening-offset")));

  // 2. events dispatched at the element itself.
  await page.evaluate(() => {
    const g = document.querySelector("[data-plan-opening^='door']");
    const b = g.getBoundingClientRect();
    const make = (type, x) =>
      new PointerEvent(type, { pointerId: 7, bubbles: true, cancelable: true, clientX: x, clientY: b.y + b.height / 2, isPrimary: true, pointerType: "mouse" });
    g.setPointerCapture = () => {};
    g.releasePointerCapture = () => {};
    g.dispatchEvent(make("pointerdown", b.x + b.width / 2));
    g.dispatchEvent(make("pointermove", b.x + b.width / 2 - 60));
    g.dispatchEvent(make("pointerup", b.x + b.width / 2 - 60));
  });
  await page.waitForTimeout(2500);
  console.log("after dispatching at the element, requests seen:", JSON.stringify(seen));
  console.log("offset now:", await page.evaluate(() => document.querySelector("[data-plan-opening^='door']")?.getAttribute("data-plan-opening-offset")));
} finally {
  await db.$executeRaw`delete from public.room_sketches where id = ${paperId}`;
  await browser.close();
  await db.$disconnect();
}
