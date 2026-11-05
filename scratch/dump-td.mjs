import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>/^[A-Z0-9_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport:{width:390,height:900}, locale:"ar-EG" })).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil:"domcontentloaded", timeout:90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout:40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g,"").replace(/-/g,"").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({secret, encoding:"base32", step:30, digits:6}));
await p.click("button[type=submit]");
for (let i=0;i<20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil:"domcontentloaded", timeout:90000 });
await p.waitForTimeout(14000);
const out = await p.evaluate(() => {
  const tds = [...document.querySelectorAll("td")].filter((td) => (td.textContent ?? "").includes("رابط غير موثق"));
  return tds.map((td) => ({
    html: td.innerHTML.slice(0, 220),
    text: (td.textContent ?? "").replace(/\s+/g," ").trim().slice(0, 120),
    row: (td.closest("tr")?.textContent ?? "").replace(/\s+/g," ").trim().slice(0, 160),
  }));
});
console.log(`خلايا: ${out.length}`);
for (const o of out) { console.log("\nنص: " + o.text); console.log("سطر: " + o.row); console.log("اتش تي ام ال: " + o.html); }
await b.close();
