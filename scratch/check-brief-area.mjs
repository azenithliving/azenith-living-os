import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * The brief form asks his area now — measured by filling it like a person and reading the row.
 *   node scratch/check-brief-area.mjs [base]
 *
 * A customer walks the request brief, taps his area among the store's own chips, and saves. The
 * claim being tested is not that the chip exists but that the row the store keeps holds his place
 * beside his taste — the pair the region station needs, and the pair that never existed together
 * in any of the 25 visitor rows before today.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const PHONE = "01066655443";
const AREA = "الشيخ زايد";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));

await page.goto(`${BASE}/request`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);

const NAV = ["التالي", "السابق", "حفظ كراسة الشروط", "الانتقال إلى واتساب"];

/**
 * Answers the station: exactly one option per group.
 *
 * Clicking every option is how the walk stalls — these buttons toggle, so a sweep through the
 * group leaves it empty and the step's own rule refuses to advance. Only inside the brief's own
 * form: the advisor's bubble is a button on the same page, and clicking it covers the form.
 */
async function answerStep() {
  return page.evaluate((nav) => {
    const form = document.querySelector("main form");
    if (!form) return 0;
    const groups = new Map();
    [...form.querySelectorAll("button")]
      .filter((btn) => btn.getClientRects().length && !nav.includes((btn.textContent || "").trim()))
      .forEach((btn) => {
        const key = `${btn.parentElement?.className ?? ""}#${(
          btn.parentElement?.parentElement?.querySelector("h1,h2,h3,h4,p,span")?.textContent ?? ""
        ).slice(0, 18)}`;
        if (!groups.has(key)) groups.set(key, btn);
      });
    groups.forEach((btn) => btn.click());
    return groups.size;
  }, NAV);
}

let reached = false;
for (let round = 0; round < 8 && !reached; round++) {
  const answered = await answerStep();
  await page.waitForTimeout(1200);
  if (round === 0) console.log(`   الخطوة الأولى: ${answered} مجموعة إجابات`);
  const next = page.getByRole("button", { name: "التالي" });
  if (await page.locator("[data-lead-area]").count()) {
    reached = true;
    break;
  }
  if ((await next.count()) === 0) {
    reached = (await page.locator("[data-lead-area]").count()) > 0;
    break;
  }
  await next.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1800);
}

const chips = await page.locator("[data-area-chip]").count();
console.log(`=== وصلت خطوة بيانات الاتصال؟ ${reached ? "أيوه" : "لأ"} · شارات المنطقة المعروضة: ${chips}`);
if (!reached || chips === 0) {
  console.log("الآلة ما وصلتش للشارة — بتوقف من غير ما تدّعي.");
  await page.screenshot({ path: "scratch/brief-area-stuck.png" });
  await b.close();
  process.exit(1);
}

const inputs = page.locator("main form input");
const count = await inputs.count();
// الاسم والموبايل هما أول حقلين في الخطوة الأخيرة (البريد اختياري).
if (count >= 2) {
  await inputs.nth(0).fill("سيف القياس");
  await inputs.nth(1).fill(PHONE);
}
await page.locator(`[data-area-chip="${AREA}"]`).click();
await page.waitForTimeout(600);
const selected = await page.locator(`[data-area-chip="${AREA}"]`).getAttribute("data-area-chip-selected");
console.log(`   الشارة اتضغطت ومختارة؟ ${selected === "1" ? "أيوه" : "لأ"}`);

await page.getByRole("button", { name: "حفظ كراسة الشروط" }).click();
await page.waitForTimeout(12000);
const saved = await page.evaluate(() => document.body.innerText.includes("تم حفظ طلبك"));
console.log(`   الرد «تم حفظ طلبك»؟ ${saved ? "أيوه" : "لأ"}`);
await page.screenshot({ path: "scratch/brief-area-saved.png" });
await page.close();

const { data: rows } = await db
  .from("users")
  .select("full_name,phone,area,style,room_type,budget,service_type")
  .like("phone", `%${PHONE.slice(-6)}`)
  .limit(3);
console.log("\n=== السطر اللي الفورم كتبه");
for (const r of rows ?? []) {
  console.log(`   اسم=${r.full_name ?? "فاضي"} · موبايل=${r.phone} · منطقة=${r.area ?? "فاضي"} · طراز=${r.style ?? "فاضي"} · غرفة=${r.room_type ?? "فاضي"}`);
}
const pair = (rows ?? []).filter((r) => String(r.area ?? "").trim() && String(r.style ?? "").trim()).length;
console.log(`   سطر فيه منطقة وطراز مع بعض: ${pair}`);

const { count: withArea } = await db.from("users").select("id", { count: "exact", head: true }).not("area", "is", null).limit(1);
const { count: both } = await db
  .from("users")
  .select("id", { count: "exact", head: true })
  .not("area", "is", null)
  .not("style", "is", null)
  .neq("style", "")
  .limit(1);
console.log(`   في السجل كله: سطور عليها منطقة = ${withArea ?? "?"} · منها عليها كمان طراز = ${both ?? "?"}`);

console.log(`\nأخطاء الكونسول: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 5)) console.log(`  • ${e}`);
await b.close();
