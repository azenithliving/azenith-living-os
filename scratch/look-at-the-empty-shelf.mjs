import { chromium } from "@playwright/test";

/** Re-capture the visitor's empty shelf as the visitor actually sees it (drawer closed). */
const BASE = "https://azenith-living.vercel.app";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 140)));
p.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
await p.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.screenshot({ path: "scratch/shop-empty-390.png" });
const panel = p.locator("section").first();
await panel.screenshot({ path: "scratch/shop-empty-panel.png" }).catch(() => {});
const words = (await p.locator("main").innerText()).replace(/\s+/g, " ");
console.log("state:", await p.locator("main").getAttribute("data-shelf-state"));
console.log("words:", words.slice(0, 300));
console.log("console errors:", errors.length);
await b.close();
