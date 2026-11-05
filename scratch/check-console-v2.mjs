import fs from "node:fs";
import { chromium } from "@playwright/test";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`${m.type()}: ${m.text().slice(0, 180)}`); });
p.on("pageerror", (e) => errs.push(`pageerror: ${String(e.message).slice(0, 180)}`));
await p.goto("http://localhost:3222/gate/login", { waitUntil: "domcontentloaded" });
await p.waitForSelector('input[type="email"]');
await p.fill('input[type="email"]', env.ADMIN_GATE_EMAIL.trim());
await p.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD.trim());
await p.click('button[type="submit"]');
await p.waitForTimeout(3500);
if ((await p.evaluate(() => document.body.innerText)).includes("التحقق بخطوتين")) {
  const s = (await import("speakeasy")).default;
  await p.locator('input:not([type="hidden"])').last().fill(s.totp({ secret: env.ADMIN_GATE_2FA_SECRET.trim().toUpperCase(), encoding: "base32" }));
  await p.click('button[type="submit"]');
  await p.waitForTimeout(4000);
}
await p.goto("http://localhost:3222/admin/v2", { waitUntil: "domcontentloaded" });
await p.waitForSelector("[data-employee-card]", { timeout: 60000 });
await p.waitForTimeout(5000);
console.log(errs.length ? errs.slice(0, 8).join("\n") : "no console errors");
await b.close();
