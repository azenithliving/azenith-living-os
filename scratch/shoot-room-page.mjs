import { chromium } from "@playwright/test";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await p.goto("https://azenith-living.vercel.app/rooms/living-room", { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(7000);
console.log("h1:", await p.evaluate(() => document.querySelector("h1")?.textContent?.replace(/\s+/g," ").trim()));
await p.screenshot({ path: "scratch/room-name-living.png" });
await b.close();
