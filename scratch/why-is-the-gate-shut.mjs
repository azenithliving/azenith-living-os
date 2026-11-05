import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/** Why did the gate keep me out? Prints what the page says at every press. */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const say = async (tag) => {
  const text = (await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 260);
  console.log(`[${tag}] url=${p.url()}\n        ${text}`);
};

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(3500);
await say("opened");
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForTimeout(6000);
await say("after password");

const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
const codes = [-1, 0, 1].map((d) => speakeasy.totp({ secret, step: 30, digits: 6, window: 0, time: Math.floor(Date.now() / 1000) + d * 30 }));
console.log("local clock:", new Date().toISOString());
if (!(await p.locator('input[placeholder="000000"]').count())) {
  await b.close();
  process.exit(0);
}
await p.fill('input[placeholder="000000"]', codes[1]);
await p.click("button[type=submit]");
await p.waitForTimeout(8000);
await say("after totp(current)");
if (p.url().includes("/gate/login")) {
  await p.fill('input[placeholder="000000"]', codes[0]);
  await p.click("button[type=submit]");
  await p.waitForTimeout(8000);
  await say("after totp(previous)");
}
await p.goto(`${BASE}/admin/v2/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await say("desk");
await b.close();
