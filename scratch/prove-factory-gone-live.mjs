/**
 * Proof on the published site that the factory layer is really gone: the old workshop
 * address answers with a redirect instead of a page, and the erased doors answer 404 to a
 * signed-in admin — while the screens that remain still load.
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
const p = await (await b.newContext()).newPage();
await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(1500);

const gone = await p.evaluate(async () => {
  const probe = async (url) => (await fetch(url, { cache: "no-store" })).status;
  return {
    inventoryDoor: await probe("/api/admin/manufacturing/inventory"),
    scenarioDoor: await probe("/api/admin/agents/simulate-scenario"),
    customersDoor: await probe("/api/admin/customers"),
  };
});

await p.goto(`${BASE}/admin/manufacturing`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(4000);
console.log("the workshop address lands on:", new URL(p.url()).pathname + new URL(p.url()).search);
console.log("erased production door:", gone.inventoryDoor, "| erased scenario door:", gone.scenarioDoor, "| customers door (must be 200):", gone.customersDoor);

await p.goto(`${BASE}/admin/agents`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(7000);
const agents = await p.locator("body").innerText();
console.log("the swarm centre renders:", /مركز الوكلاء|الوكلاء/.test(agents));
await p.screenshot({ path: "scratch/factory-gone-live.png" });
await b.close();
