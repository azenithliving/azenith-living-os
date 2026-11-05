import { chromium } from "@playwright/test";

/** Look at the footer a customer lands on, at his phone width. */
const BASE = "https://azenith-living.vercel.app";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
const footer = p.locator("footer");
await footer.scrollIntoViewIfNeeded();
await p.waitForTimeout(1500);
await footer.screenshot({ path: "scratch/footer-hours-390.png" });
const text = (await footer.innerText()).replace(/\s+/g, " ");
console.log(`footer text: ${text.slice(0, 420)}`);
console.log(`latin digits in the footer: ${/[0-9]/.test(text) ? "YES — a defect" : "none"}`);
console.log(`console errors: ${errors.length}${errors.length ? " → " + errors.slice(0, 3).join(" | ") : ""}`);
await b.close();
