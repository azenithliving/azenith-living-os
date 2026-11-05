import fs from "node:fs";
import { chromium } from "@playwright/test";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
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
// The doors this screen really calls. The old list here probed `/api/admin/quality-metrics`, a URL
// no code has ever contained (checked with `git log -S`), and its 404 was written up as a panel
// defect on 2026-10-03. A probe may only ask about doors the page opens.
for (const u of ["/api/admin/notifications?limit=20", "/api/admin/quality?limit=100"]) {
  const r = await p.evaluate(async (url) => {
    try { const res = await fetch(url, { cache: "no-store" }); return `${res.status} ${(await res.text()).slice(0, 90)}`; }
    catch (e) { return `THREW ${String(e.message).slice(0, 80)}`; }
  }, u);
  console.log(u, "->", r);
}
await b.close();
