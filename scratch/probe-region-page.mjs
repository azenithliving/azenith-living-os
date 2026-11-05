import { chromium } from "@playwright/test";
const base = process.argv[2] || "https://azenith-living.vercel.app";
const token = process.argv[3];
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(`${base}/passport/${token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);
const info = await p.evaluate(() => ({
  attrs: [...document.querySelectorAll("[data-area-chip],[data-contact-city],[data-contact-offer],[data-region-line],[data-colour-swatch],[data-family-room]")]
    .map((el) => el.tagName + ":" + (el.getAttribute("data-area-chip") || el.getAttribute("data-contact-city") || el.getAttribute("data-colour-swatch") || Object.keys(el.dataset).join("/")))
    .slice(0, 25),
  headings: [...document.querySelectorAll("h1,h2")].map((h) => (h.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)).slice(0, 10),
}));
console.log(JSON.stringify(info, null, 1));
await b.close();
