import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * The elite brief asks his taste and his area now — measured by walking it on his phone width
 * and reading the row it writes.
 *   node scratch/check-elite-taste.mjs [base]
 *
 * Before today the screen answered the taste question for him with its own page name («elite-brief»
 * in 14 of 27 rows). The claim being tested is the pair on the row: a taste he tapped and the
 * place he tapped — and that no new row arrives wearing a screen's name.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const PHONE = "01077788991";
const NAME = "يوسف القياس";
const TASTE = "مودرن";
const AREA = "التجمع";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const startedAt = new Date().toISOString();

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

await page.goto(`${BASE}/elite-brief`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);

const NAV = [/^Continue$|^التالي$|^Back$|^رجوع$|^Submit/i];

/** One option per answer group, inside the brief card only — a sweep of a toggling group empties it. */
async function answerOne() {
  return page.evaluate((navSource) => {
    const navs = navSource.map((p) => new RegExp(p));
    const card = document.querySelector("main div.rounded-2xl, main form") ?? document.body;
    const groups = new Map();
    [...card.querySelectorAll("button")]
      .filter((btn) => btn.getClientRects().length)
      .filter((btn) => !navs.some((p) => p.test((btn.textContent || "").trim())))
      .forEach((btn) => {
        const key = `${btn.parentElement?.className ?? ""}#${(
          btn.parentElement?.previousElementSibling?.textContent ?? ""
        ).slice(0, 24)}`;
        if (!groups.has(key)) groups.set(key, btn);
      });
    groups.forEach((btn) => btn.click());
    return groups.size;
  }, NAV);
}

const nextBtn = () => page.getByRole("button", { name: /Continue|التالي/ }).first();

// Steps 1..3 carry the required answers; step 4 is the new taste/area station.
for (let step = 1; step <= 3; step++) {
  const answered = await answerOne();
  await page.waitForTimeout(900);
  console.log(`   خطوة ${step}: ${answered} مجموعة إجابات`);
  await nextBtn().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const tasteChips = await page.locator("[data-elite-taste-chip]").count();
const areaChips = await page.locator("[data-elite-area-chip]").count();
console.log(`=== وصلت محطة الذوق؟ ${tasteChips > 0 ? "أيوه" : "لأ"} · شارات الذوق: ${tasteChips} · شارات المنطقة: ${areaChips}`);
if (!tasteChips || !areaChips) {
  console.log("الآلة ما وصلتش للمحطة — بتوقف من غير ما تدّعي.");
  await page.screenshot({ path: "scratch/elite-taste-stuck.png" });
  await b.close();
  process.exit(1);
}

await page.screenshot({ path: "scratch/elite-taste-step.png" });
await page.locator(`[data-elite-taste-chip="${TASTE}"]`).click();
await page.locator(`[data-elite-area-chip="${AREA}"]`).click();
await page.waitForTimeout(700);
const tasteSel = await page.locator(`[data-elite-taste-chip="${TASTE}"]`).getAttribute("data-elite-taste-chip-selected");
const areaSel = await page.locator(`[data-elite-area-chip="${AREA}"]`).getAttribute("data-elite-area-chip-selected");
console.log(`   الشارتين مختارة؟ ذوق=${tasteSel === "1" ? "أيوه" : "لأ"} · منطقة=${areaSel === "1" ? "أيوه" : "لأ"}`);

// past details (optional) to contact
await nextBtn().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
await nextBtn().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1800);

await page.locator('input[type="text"]').last().fill(NAME);
await page.locator('input[type="tel"]').first().fill(PHONE);
await page.waitForTimeout(500);

await page.getByRole("button", { name: /Submit Brief|أرسل طلبك/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(14000);
const saved = await page.evaluate(() => /تم استلام طلبك|Brief Submitted|Successfully/i.test(document.body.innerText));
console.log(`   شاشة الاستلام ظهرت؟ ${saved ? "أيوه" : "لأ"}`);
await page.screenshot({ path: "scratch/elite-taste-saved.png" });
await page.close();

const { data: rows } = await db
  .from("users")
  .select("full_name,phone,area,style,room_type,last_page,created_at")
  .like("phone", `%${PHONE.slice(-6)}`)
  .limit(3);
console.log("\n=== السطر اللي نموذج النخبة كتبه");
for (const r of rows ?? []) {
  console.log(`   اسم=${r.full_name} · منطقة=${r.area ?? "فاضي"} · طراز=${r.style ?? "فاضي"} · غرفة=${r.room_type ?? "فاضي"} · صفحة=${r.last_page ?? "فاضي"}`);
}
const pair = (rows ?? []).filter((r) => String(r.area ?? "").trim() && String(r.style ?? "").trim()).length;
console.log(`   سطر فيه منطقة وطراز مع بعض: ${pair}`);

const { data: freshSlugs } = await db
  .from("users")
  .select("id,style,created_at")
  .gte("created_at", startedAt)
  .or("style.is.null,style.not.eq.elite-brief")
  .limit(5);
const { count: slugRows } = await db
  .from("users")
  .select("id", { count: "exact", head: true })
  .gte("created_at", startedAt)
  .eq("style", "elite-brief");
console.log(`\n   سطور جديدة اتكتبت من الساعة ${startedAt.slice(11, 16)} وعليها اسم الصفحة: ${slugRows ?? 0}`);

const { count: slugTotal } = await db
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("style", "elite-brief");
const { count: allRows } = await db.from("users").select("id", { count: "exact", head: true });
const { count: withPair } = await db
  .from("users")
  .select("id", { count: "exact", head: true })
  .not("area", "is", null)
  .not("style", "is", null);
console.log(`   سجل الزوار: ${allRows ?? 0} سطر · عليها طراز «elite-brief»: ${slugTotal ?? 0} (ما اتلمسّتش — الحذف كلمة المالك) · عليها منطقة وطراز: ${withPair ?? 0}`);
console.log(`   أخطاء الكونسول: ${errors.length ? errors.join(" | ") : "صفر"}`);
await b.close();
