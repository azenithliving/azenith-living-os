import { chromium } from "@playwright/test";
const BASE = "https://azenith-living.vercel.app";
const TOKEN = process.argv[2];
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
await p.goto(`${BASE}/passport/${TOKEN}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(10000);
const info = await p.evaluate(async (token) => {
  const res = await fetch(`/api/passport/${token}`, { headers: { "x-visit-key": "shapeprobe000001" } });
  const data = await res.json();
  const attrs = new Set();
  document.querySelectorAll("[data-colour],[data-colour-pick],[data-family],[data-family-name],[data-family-vote],[data-hex],[data-dimension],[data-sheet]").forEach((el) => {
    for (const a of el.getAttributeNames()) if (a.startsWith("data-")) attrs.add(a);
  });
  const allData = new Set();
  document.querySelectorAll("[data-]").forEach ? null : null;
  document.querySelectorAll("*").forEach((el) => el.getAttributeNames?.().forEach((a) => { if (a.startsWith("data-")) allData.add(a); }));
  const inputs = [...document.querySelectorAll("input")].map((i) => `${i.type || "text"}:${i.placeholder || i.name || "?"}`);
  const buttons = [...document.querySelectorAll("button")].map((x) => (x.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26)).filter(Boolean).slice(0, 22);
  return {
    http: res.status,
    topKeys: Object.keys(data || {}),
    sheetKeys: Object.keys(data?.sheet || {}),
    readingKeys: Object.keys(data?.reading || {}),
    dims: data?.sheet?.dimensions ?? data?.reading?.dimensions ?? data?.sheet?.customerDimensions ?? null,
    ok: data?.sheet?.ok ?? data?.reading?.ok ?? null,
    failure: data?.sheet?.failure ?? data?.reading?.failure ?? null,
    wanted: [...attrs],
    allData: [...allData].slice(0, 40),
    inputs,
    buttons,
  };
}, TOKEN);
console.log(JSON.stringify(info, null, 1).slice(0, 3000));
await b.close();
