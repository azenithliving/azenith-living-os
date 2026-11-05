import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * What does the gate actually receive and answer at the 2FA step?
 * Prints the request shape (lengths and field names, never values) and the response body.
 */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();

p.on("request", (r) => {
  if (!r.url().includes("/api/admin/")) return;
  const post = r.postData() ?? "";
  let keys = [];
  try {
    keys = Object.keys(JSON.parse(post));
  } catch {
    keys = ["<not json>"];
  }
  console.log(`→ ${r.method()} ${r.url().replace(BASE, "")} fields: ${keys.join(",")} bytes: ${post.length}`);
});
p.on("response", async (r) => {
  if (!r.url().includes("/api/admin/")) return;
  const body = await r.text().catch(() => "");
  console.log(`← ${r.status()} ${r.url().replace(BASE, "")} ${body.slice(0, 220)}`);
});

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(3500);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
const code = speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 });
console.log(`generated code length=${code.length} digits-only=${/^[0-9]{6}$/.test(code)} · local epoch=${Math.floor(Date.now() / 1000)}`);
await p.fill('input[placeholder="000000"]', code);
console.log("buttons on the 2FA card:", await p.locator("button").allInnerTexts());
await p.click("button[type=submit]");
await p.waitForTimeout(9000);
console.log("landed on:", p.url());
await b.close();
