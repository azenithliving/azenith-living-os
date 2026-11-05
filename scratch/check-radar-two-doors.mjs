import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * One conversation feeds both doors — measured on the published store at 390px.
 *   node scratch/check-radar-two-doors.mjs [base]
 *
 * The claim being tested: a customer who says his area and his style to the advisor leaves a row
 * that holds both, and a sheet in that area then says its pictures were ordered by the colours of
 * his area's papers AND the style its visitors asked for. A sheet in another area must name a
 * different evidence — otherwise the radar is not reading the area, it is reading itself.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";
const PHONE = "01077776655";
const SAY = `أنا بجهز شقة في التجمع وعايز ركنة مودرن للصة، رقمي ${PHONE}`;
const AREA = "التجمع";
const OTHER_AREA_PAPER = 119; // same general set, another area: its line must read differently

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const errors = [];

async function openSheet(id) {
  const { data } = await db.from("room_sketches").select("token,customer_city,colour_picks").eq("id", id).maybeSingle();
  if (!data?.token) throw new Error(`ورقة ${id} مالهاش عنوان`);
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
  await page.goto(`${BASE}/passport/${data.token}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  const read = await page.evaluate(() => {
    const line = document.querySelector("[data-region-line]");
    const room = document.querySelector("[data-family-room]");
    return {
      tier: line?.getAttribute("data-region-line") ?? null,
      line: (line?.textContent ?? "").replace(/\s+/g, " ").trim(),
      first: [...(room?.querySelectorAll("img") ?? [])].slice(0, 6).map((im) => (im.getAttribute("src") ?? "").split("/").pop() ?? ""),
    };
  });
  return { page, ...read };
}

// ── ١) محادثة بتقول منطقة وطراز ─────────────────────────────────────────────
// `sheets` skips this step and reads only the sheets: the conversation was already proven on an
// earlier run, and every new one costs the owner a row he cannot delete without his word.
const SHEETS_ONLY = process.argv.includes("sheets");
let row = null;
if (!SHEETS_ONLY) {
  const chat = await ctx.newPage();
  chat.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 90)));
  await chat.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await chat.waitForTimeout(9000);
  await chat.locator("[data-chat-open]").first().click({ force: true });
  await chat.waitForTimeout(2500);
  await chat.getByPlaceholder("اكتب رسالتك...").fill(SAY);
  await chat.locator("[data-chat-send]").first().click();
  await chat.waitForSelector("[data-chat-bubble=assistant]", { timeout: 90000 });
  await chat.waitForTimeout(3000);
  const sessionId = await chat.evaluate(() => localStorage.getItem("azenith_session_id"));
  await chat.close();
  await new Promise((r) => setTimeout(r, 6000));
  const { data: rows } = await db.from("users").select("phone,area,style,room_type").eq("session_id", String(sessionId));
  row = rows?.[0] ?? null;
  console.log("=== ١) السطر اللي المحادثة كتبته");
  console.log(
    row
      ? `   موبايل=${row.phone ?? "فاضي"} · منطقة=${row.area ?? "فاضي"} · طراز=${row.style ?? "فاضي"} · غرفة=${row.room_type ?? "فاضي"}`
      : "   مفيش سطر — المحادثة ما سجلتش حاجة",
  );
}

// ── ٢) نفس الورقتين، والرادار بقى يقرأ من باب تاني ──────────────────────────
const mine = await openSheet(118);
console.log(`\n=== ٢) ورقة 118 (${AREA})`);
console.log(`   الطبقة: ${mine.tier}`);
console.log(`   السطر: ${mine.line}`);
console.log(`   أول ست: ${mine.first.join(", ")}`);
const box = mine.page.locator("[data-family-room]").first();
if (await box.count()) {
  await box.scrollIntoViewIfNeeded().catch(() => {});
  await box.screenshot({ path: "scratch/radar-two-doors.png" }).catch(() => {});
}
await mine.page.close();

const other = await openSheet(OTHER_AREA_PAPER);
console.log(`\n=== ٣) ورقة ${OTHER_AREA_PAPER} (منطقة تانية، نفس صور البنك)`);
console.log(`   الطبقة: ${other.tier}`);
console.log(`   السطر: ${other.line}`);
console.log(`   أول ست: ${other.first.join(", ")}`);
await other.page.close();

console.log("\n=== الحكم");
console.log(`   السطر بيسمّي الباب التاني (الطراز)؟ ${mine.line.includes("طراز") ? "أيوه" : "لأ"}`);
console.log(`   وبيسمّي الأول (الألوان)؟ ${mine.line.includes("ألوان") ? "أيوه" : "لأ"}`);
console.log(`   المنطقتين سطرين مختلفين؟ ${mine.line !== other.line ? "أيوه" : "لأ"}`);
console.log(`   ترتيب الصور اختلف بينهم؟ ${mine.first.join() !== other.first.join() ? "أيوه" : "لأ"}`);
console.log(`   أخطاء الكونسول: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 5)) console.log(`     • ${e}`);

const { data: all } = await db.from("users").select("area,style,room_type").not("area", "is", null).limit(50);
console.log(`\n=== السطور اللي عليها منطقة دلوقتي (${(all ?? []).length})`);
for (const r of all ?? []) console.log(`   منطقة=${r.area} · طراز=${r.style ?? "فاضي"} · غرفة=${r.room_type ?? "فاضي"}`);
await b.close();
