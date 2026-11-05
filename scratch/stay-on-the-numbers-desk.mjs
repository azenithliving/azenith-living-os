import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/** Are those two console errors real, or the browser aborting requests when the page moves? */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 110)));
p.on("pageerror", (e) => errors.push(String(e).slice(0, 110)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("[data-numbers-card]", { timeout: 40000 });
await p.waitForTimeout(15000);
const rows = await p.locator("[data-numbers-card] li").count();
const cardText = (await p.locator("[data-numbers-card]").innerText()).replace(/\s+/g, " ");
console.log(`stayed on the desk for 15 seconds: rows=${rows} · card=«${cardText.slice(0, 140)}»`);
console.log(`console errors while staying put: ${errors.length}${errors.length ? " → " + errors.slice(0, 4).join(" | ") : ""}`);
await b.close();
