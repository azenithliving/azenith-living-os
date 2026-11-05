/**
 * The owner's quick-action buttons on the live swarm centre: what they say, and whether the
 * screen is quiet. A button that calls a removed tool is the defect this looks for.
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const BASE = process.argv.find((a) => a.startsWith("http")) || "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().split("\n")[0].slice(0, 90)); });

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

await p.goto(`${BASE}/admin/agents`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(9000);
const body = await p.locator("body").innerText();
console.log("revenue button present:", /تقرير الإيرادات/.test(body));
console.log("stock button present:", /فحص المخزون/.test(body));
console.log("new customer button present:", /قائمة العملاء/.test(body));
console.log("new page-health button present:", /فحص صحة الصفحات/.test(body));
console.log("console errors:", errors.length ? [...new Set(errors)].slice(0, 3) : "none");
await p.screenshot({ path: "scratch/quick-actions-live.png" });
await b.close();
