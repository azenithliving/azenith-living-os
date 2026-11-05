import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * The customer says his area to the advisor; does the store keep it? — the published site, 390px.
 *   node scratch/check-chat-area.mjs [base]
 *
 * Three things are measured, in the order they happen: a real conversation opened in the customer's
 * browser names an area and leaves a number; the row that conversation owns holds that area in the
 * store's map spelling; and the owner's pre-call file shows it, named as coming from his words. The
 * negative control is the store's own mouth: its coverage answer recites every district, so if the
 * reader were fed the advisor's sentences, every conversation would suddenly have an area.
 */
const BASE = process.argv[2] ?? "https://azenith-living.vercel.app";
const PHONE = "01088887766";
const SAY = `أنا بجهز شقة ١٨٠ متر في التجمع وعايز ركنة مودرن، رقمي ${PHONE}`;

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const errors = [];

// ── ١) المحادثة من متصفح العميل ─────────────────────────────────────────────
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);

const opener = page.locator("[data-chat-open]").first();
if ((await opener.count()) === 0) throw new Error("زر فتح الشات مش موجود — البناء قديم؟");
await opener.click({ force: true });
await page.waitForTimeout(2500);

const input = page.getByPlaceholder("اكتب رسالتك...");
await input.fill(SAY);
await page.locator("[data-chat-send]").first().click();
await page.waitForSelector("[data-chat-bubble=assistant]", { timeout: 90000 });
await page.waitForTimeout(3000);
const sessionId = await page.evaluate(() => localStorage.getItem("azenith_session_id"));
const bubbles = await page.locator("[data-chat-bubble]").count();
console.log(`=== ١) محادثة حقيقية: فقاعات ${bubbles} · مفتاح الجلسة ${sessionId ? "اتسجل" : "مفيش"}`);
await page.locator("[data-chat-bubble]").last().screenshot({ path: "scratch/chat-area-said.png" });
await page.close();

// ── ٢) السجل نفسه ──────────────────────────────────────────────────────────
await new Promise((r) => setTimeout(r, 6000));
const { data: rows } = await db.from("users").select("id,session_id,phone,area").eq("session_id", String(sessionId));
const row = rows?.[0] ?? null;
console.log(`=== ٢) الصف اللي المحادثة كتبته: ${row ? "موجود" : "مفيش صف"}`);
if (row) console.log(`   موبايل=${row.phone ?? "فاضي"} · المنطقة=${row.area ?? "فاضي"}`);
const { count: withArea } = await db.from("users").select("id", { count: "exact", head: true }).not("area", "is", null).limit(1);
const { count: allUsers } = await db.from("users").select("id", { count: "exact", head: true }).limit(1);
console.log(`   التحكم السلبي: ${allUsers ?? "?"} سطر زوار، اللي عليه منطقة: ${withArea ?? "?"}`);

// ── ٣) ملف المالك قبل المكالمة ──────────────────────────────────────────────
const admin = await ctx.newPage();
admin.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
await admin.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await admin.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await admin.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await admin.click("button[type=submit]");
await admin.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await admin.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await admin.click("button[type=submit]");
for (let i = 0; i < 20 && !admin.url().includes("/admin"); i += 1) await admin.waitForTimeout(1500);
console.log(`=== ٣) داخل شاشة المالك؟ ${admin.url().includes("/admin") ? "أيوه" : "لأ"}`);

await admin.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await admin.waitForTimeout(9000);
await admin.locator("[data-dossier-search]").first().fill(PHONE);
await admin.waitForTimeout(7000);
const pick = admin.locator("[data-dossier-pick]").first();
if (await pick.count()) {
  await pick.click().catch(() => {});
  await admin.waitForTimeout(12000);
}
const dossier = await admin.evaluate(() => {
  const panel = document.querySelector("[data-dossier-panel]");
  return panel ? (panel.textContent ?? "").replace(/\s+/g, " ") : null;
});
console.log(dossier ? `   الملف: ${dossier.slice(0, 260)}` : "   مفيش لوحة ملف");
console.log(`   سطر «منطقته من كلامه» موجود؟ ${dossier && dossier.includes("منطقته من كلامه") ? "أيوه" : "لأ"}`);
const panelBox = admin.locator("[data-dossier-panel]").first();
if (await panelBox.count()) {
  await panelBox.scrollIntoViewIfNeeded().catch(() => {});
  await panelBox.screenshot({ path: "scratch/chat-area-dossier.png" }).catch(() => {});
}
await admin.close();

console.log(`\nأخطاء الكونسول: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 6)) console.log(`  • ${e}`);
await b.close();
