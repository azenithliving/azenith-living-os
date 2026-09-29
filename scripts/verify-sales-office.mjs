/**
 * Proves the customers employee lives in the new house on the published site.
 * Logs in through the gate, opens the new window, and walks one customer to the
 * delete confirmation — then cancels. The red button is never pressed: this store's
 * customer rows are the owner's real records.
 *
 * Usage: node scripts/verify-sales-office.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = process.argv.find((a) => a.startsWith("http")) || "https://azenith-living.vercel.app";
const results = [];
const check = (name, pass, extra = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${extra ? ` :: ${extra.slice(0, 90)}` : ""}`);
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.fill('input[type=email]', env.ADMIN_GATE_EMAIL);
await p.fill('input[type=password]', env.ADMIN_GATE_PASSWORD);
await p.click('button[type=submit]');
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click('button[type=submit]');
for (let i = 0; i < 15 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);
check("gate login", p.url().includes("/admin"), p.url());

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);
const body = (await p.textContent("body")) || "";
check("the new window is the sales office", body.includes("مكتب المبيعات"), "");
check("the apology signpost is gone", !/هذه الصفحة فاضية/.test(body));
const rows = await p.locator('div[class*="hover:bg-white"]').count();
check("the customers list renders live", rows > 0, `rows=${rows}`);
check("the tier filter is present", /الماسي|ماسي/.test(body) && /ذهبي/.test(body));
fs.mkdirSync("scratch", { recursive: true });
await p.screenshot({ path: "scratch/sales-office-new.png", fullPage: false });

// Open one customer: the row is collapsed, so the row itself is clicked first and
// only then the analysis control inside it.
const row = p.locator('div[class*="gap-4 flex-1"]').first();
if (await row.count()) {
  await row.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(3500);
}
const first = p.locator('button:has-text("تحليل ذكي عميق")').first();
if (await first.count()) {
  await first.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(6000);
  const opened = (await p.textContent("body")) || "";
  check("a customer opens their own card", /الاهتمامات|الطراز|إشارات الشراء/.test(opened));
} else {
  check("a customer row can be opened", false, "no analysis control after clicking the row");
}
const trash = p.locator('button:has(svg.lucide-trash-2)').first();
if (await trash.count()) {
  await trash.click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const ask = (await p.textContent("body")) || "";
  check("the delete confirmation counts before it asks", /تأكيد الحذف النهائي/.test(ask));
  await p.screenshot({ path: "scratch/sales-office-delete-ask.png" });
  const cancel = p.locator('button:has-text("إلغاء")').first();
  if (await cancel.count()) {
    await cancel.click({ timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(1500);
    const after = (await p.textContent("body")) || "";
    check("cancelling closes it and deletes nothing", !/تأكيد الحذف النهائي/.test(after));
  }
} else {
  check("a delete control exists on the row", false, "no trash button found");
}

// Parity: the old address must still serve the same employee until the old house is erased.
await p.goto(`${BASE}/admin/sales?tab=leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
await p.waitForTimeout(6000);
const old = (await p.textContent("body")) || "";
check("the old address still serves customers", /العملاء/.test(old) && /ماسي/.test(old));

const realErrors = errors.filter((e) => !/favicon|Download the React DevTools|401|Failed to load resource: the server responded with a status of 4/i.test(e));
check("no console errors while browsing", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));

await b.close();
const passed = results.filter(Boolean).length;
console.log(`\n=== SALES OFFICE: ${passed}/${results.length} passed on ${BASE} ===`);
if (passed !== results.length) process.exitCode = 1;
