import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * The second elite screen files itself — walked on the published store and read back from the row.
 *   node scratch/check-elite-intelligence.mjs [base]
 *
 * Measured 2026-10-09: the elite door wrote "/elite-brief" into every row it took, whichever screen
 * the customer stood on, so the owner's pre-call paper named the wrong screen. This walk answers a
 * Silver-tier brief (first scope, first budget, open timeline) and reads the address the row holds.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const PHONE = "01088899002";
const NAME = "هادي القياس";
const TASTE = "كلاسيك";
const AREA = "مدينتي";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

await page.goto(`${BASE}/elite-intelligence`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(10000);

const clickNth = async (n) =>
  page.evaluate((index) => {
    const card = document.querySelector("main div.rounded-2xl") ?? document.body;
    const buttons = [...card.querySelectorAll("button")].filter(
      (btn) => btn.getClientRects().length && !/^(التالي|Continue|رجوع|Back)/i.test((btn.textContent || "").trim()),
    );
    const btn = index === -1 ? buttons[buttons.length - 1] : buttons[index];
    if (!btn) return { clicked: 0, total: buttons.length, label: "" };
    const label = (btn.textContent || "").trim().slice(0, 26);
    btn.click();
    return { clicked: 1, total: buttons.length, label };
  }, n);

const clickLabel = async (pattern) =>
  page.evaluate((source) => {
    const re = new RegExp(source, "i");
    const card = document.querySelector("main div.rounded-2xl") ?? document.body;
    const btn = [...card.querySelectorAll("button")].find((b) => b.getClientRects().length && re.test(b.textContent || ""));
    if (!btn) return "ما اتلاقيش";
    const label = (btn.textContent || "").trim().slice(0, 26);
    btn.click();
    return label;
  }, pattern);

const next = () => page.getByRole("button", { name: /التالي|Continue/ }).first().click({ timeout: 6000 });

// 1 — scope: the first card in the store's own order.
console.log("   خطوة المساحة:", JSON.stringify(await clickNth(0)));
await page.waitForTimeout(900);
await next();
await page.waitForTimeout(1600);

// 2 — budget: the first (lowest) range, so the brief stays a Silver one.
console.log("   خطوة الميزانية:", JSON.stringify(await clickNth(0)));
await page.waitForTimeout(900);
await next();
await page.waitForTimeout(1600);

// 3 — timeline and the blueprint answer, both by their own words on the card.
// The last button in the card is the blueprint answer, not the open timeline — measured on the
// first run, where clicking by position left the step's own rule unsatisfied.
console.log("   خطوة التوقيت:", await clickLabel("مفتوح|Flexible"));
await page.waitForTimeout(700);
console.log("   عندك مخططات:", await clickLabel("محتاج استشارة|I have plans|Yes, I have"));
await page.waitForTimeout(900);
await next();
await page.waitForTimeout(1600);

const tasteChips = await page.locator("[data-elite-taste-chip]").count();
const areaChips = await page.locator("[data-elite-area-chip]").count();
console.log(`=== محطة الذوق وصلت؟ شارات الذوق=${tasteChips} · شارات المنطقة=${areaChips}`);
if (!tasteChips || !areaChips) {
  console.log("الآلة ما وصلتش للمحطة — بتوقف من غير ما تدّعي.");
  await page.screenshot({ path: "scratch/elite-intel-stuck.png" });
  await b.close();
  process.exit(1);
}
await page.locator(`[data-elite-taste-chip="${TASTE}"]`).click();
await page.locator(`[data-elite-area-chip="${AREA}"]`).click();
await page.waitForTimeout(600);
await page.screenshot({ path: "scratch/elite-intel-taste.png" });

await next();
await page.waitForTimeout(1400);
await next();
await page.waitForTimeout(1600);

await page.locator('input[type="text"]').last().fill(NAME);
await page.locator('input[type="tel"]').first().fill(PHONE);
await page.waitForTimeout(500);
await page.getByRole("button", { name: /أرسل طلبك|Submit Brief/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(15000);

const seen = await page.evaluate(() => document.body.innerText.slice(0, 260).replace(/\n+/g, " · "));
console.log(`   آخر شاشة: ${seen}`);
await page.screenshot({ path: "scratch/elite-intel-saved.png" });
await page.close();

const { data: rows } = await db
  .from("users")
  .select("full_name,phone,area,style,room_type,budget,last_page,created_at")
  .like("phone", `%${PHONE.slice(-6)}`)
  .limit(3);
console.log("\n=== السطر اللي مسار النخبة كتبه");
for (const r of rows ?? []) {
  console.log(`   اسم=${r.full_name} · عنوان الصفحة=${r.last_page ?? "فاضي"} · طراز=${r.style ?? "فاضي"} · منطقة=${r.area ?? "فاضي"} · غرفة=${r.room_type ?? "فاضي"}`);
}
const selfFiled = (rows ?? []).filter((r) => r.last_page === "/elite-intelligence").length;
console.log(`   سطور سمّت نفسها بعنوانها الصحيح: ${selfFiled}`);

const { count: mislabeled } = await db
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("last_page", "/elite-brief");
const { count: allRows } = await db.from("users").select("id", { count: "exact", head: true });
console.log(`\n   سجل الزوار: ${allRows ?? 0} سطر · المسجل تحت «ملخص النخبة»: ${mislabeled ?? 0} (القديم ما اتلمسّتش)`);
console.log(`   أخطاء الكونسول: ${errors.length ? errors.join(" | ") : "صفر"}`);
await b.close();
