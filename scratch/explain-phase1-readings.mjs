/**
 * Three follow-ups on the phase-one proof, because two of its lines were the
 * instrument's fault and one needs a source: what does his chat input actually say,
 * where does the forbidden word appear (copy or data?), and who are the five humans
 * the office counts now that it counted four.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = "http://localhost:3111";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 60000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 25 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

const placeholders = await p.evaluate(() =>
  Array.from(document.querySelectorAll("textarea, input"))
    .map((el) => el.getAttribute("placeholder"))
    .filter(Boolean)
);
console.log("inputs on his face:", JSON.stringify(placeholders));

const vip = await p.evaluate(() => {
  const hits = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const t = walk.currentNode.textContent || "";
    if (/VIP/.test(t)) {
      const el = walk.currentNode.parentElement;
      hits.push({ text: t.trim().slice(0, 90), tag: el?.tagName, cls: (el?.className || "").slice(0, 40) });
    }
  }
  return hits;
});
console.log("where VIP appears:", JSON.stringify(vip, null, 1));

const roll = await p.evaluate(async () => {
  const r = await (await fetch("/api/admin/customers", { cache: "no-store" })).json();
  return {
    totals: r.totals,
    who: (r.customers || []).map((c) => ({ name: c.name, phone: c.phone, at: c.lastTouch, spaces: c.spaces })),
  };
});
console.log("the humans he counts:", JSON.stringify(roll, null, 1));

await b.close();
