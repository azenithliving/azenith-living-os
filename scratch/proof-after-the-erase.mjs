import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/** After the erase: the visitor's page and his desk, both counted on the published site. */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const errors = [];

const visitor = await ctx.newPage();
visitor.on("console", (m) => m.type() === "error" && errors.push("visitor: " + m.text().slice(0, 120)));
visitor.on("pageerror", (e) => errors.push("visitor: " + String(e).slice(0, 120)));
await visitor.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await visitor.waitForTimeout(4000);
console.log(
  `visitor: state=${await visitor.locator("main").getAttribute("data-shelf-state")} ` +
    `«قريبًا»=${await visitor.getByText("قريبًا").count()} cards=${await visitor.locator("article").count()}`
);

const p = await ctx.newPage();
p.on("console", (m) => m.type() === "error" && errors.push("desk: " + m.text().slice(0, 120)));
p.on("pageerror", (e) => errors.push("desk: " + String(e).slice(0, 120)));
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

await p.goto(`${BASE}/admin/v2/shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForSelector("text=قطعة بتظهر للزائر", { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(2500);
const countLine = (await p.getByText("على الرفّ دلوقتي").first().textContent().catch(() => ""))?.replace(/\s+/g, " ");
const emptyDesk = await p.getByText("مفيش قطعة مسجّلة لسه").count();
const sofa = await p.getByText("صوفا ملكية").count();
await p.screenshot({ path: "scratch/shop-desk-after-erase-390.png" });
console.log(`desk: count line=«${String(countLine).trim()}» empty notice=${emptyDesk} rows naming the erased sofa=${sofa}`);
console.log(`console errors: ${errors.length}${errors.length ? " → " + errors.slice(0, 3).join(" | ") : ""}`);
await b.close();

const passed = emptyDesk === 1 && sofa === 0 && errors.length === 0;
console.log(passed ? "CLEAN" : "NOT CLEAN");
process.exit(passed ? 0 : 1);
