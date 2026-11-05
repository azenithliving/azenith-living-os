import { chromium } from "@playwright/test";
const BASE = "https://azenith-living.vercel.app";
const TOKEN = process.argv[2];
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" })).newPage();
await p.goto(`${BASE}/passport/${TOKEN}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(9000);
const out = await p.evaluate(async (token) => {
  const res = await fetch(`/api/passport/${token}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_key: "i-probe", image_url: `${location.origin}/passport/${token}`, voter: "تالت", liked: true }),
  });
  const text = await res.text();
  return { http: res.status, body: text.slice(0, 400) };
}, TOKEN);
console.log(JSON.stringify(out));
await b.close();
