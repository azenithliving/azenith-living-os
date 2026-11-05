import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * The region station, measured on the published store at 390px, on papers that already exist.
 *   node scratch/check-region-station.mjs [base]
 *
 * Three claims get tested, in the order a customer would meet them:
 *   1. an area he taps lands in the store's own column, in the map's spelling;
 *   2. while his area holds no measured paper, the sheet says so and ranks on quality;
 *   3. once his area does hold one, the same sheet says whose taste it used, and the pictures
 *      actually move — two areas producing two different orders.
 *
 * No row is created here: the four papers used are instrument papers from earlier journeys that
 * already carry the store's own key, so the contact desk accepts an area without writing a number.
 */
const BASE = process.argv[2] || "https://azenith-living.vercel.app";
const VIEWER_A = 118; // measured with no evidence in its area
const VIEWER_B = 119; // same room, other area, same candidate list
const WITNESS_A = 121; // carries colours: becomes التجمع's evidence
const WITNESS_B = 123; // colours are moved off A's trio: becomes الشيخ زايد's evidence
const EMPTY_SEER = 19; // an area nobody has filed yet: the honest empty sentence
const AREA_A = "التجمع";
const AREA_B = "الشيخ زايد";
const AREA_EMPTY = "الإسكندرية";
const SHOTS = "scratch";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

async function tokens(ids) {
  const { data, error } = await db.from("room_sketches").select("id,token").in("id", ids);
  if (error) throw new Error(`قراءة الأوراق مرفوضة: ${error.message}`);
  return new Map((data ?? []).map((r) => [Number(r.id), String(r.token)]));
}

const addressOf = (ids) => tokens(ids).then((map) => (id) => `/passport/${map.get(Number(id))}`);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });

const consoleErrors = [];
ctx.on("weberror", (e) => consoleErrors.push(String(e.error()).slice(0, 120)));

/** Opens one sheet, reads what the sheet says its ranking is standing on, and the order it shows. */
async function readSheet(path, { area, colour } = {}) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(7000);

  const chip = page.locator(`[data-area-chip="${area}"]`);
  if (area && (await chip.count()) > 0) {
    await chip.click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /أضفها|ابعتلي الاقتراحات/ }).first().click();
    await page.waitForTimeout(9000);
  } else if (area) {
    // A sheet that already holds an area does not offer the chips again: the run is repeatable.
    log(`   ${path}: المنطقة مسجلة قبل كده، مفيش شارة تتضغط`);
  }

  if (colour) {
    // Three colours is the ceiling the sheet itself enforces, so his old picks come off before the
    // new one goes on — and every tap is a real write through the door.
    for (const hex of await page.$$eval("[data-colour-swatch][data-colour-selected='1']", (els) =>
      els.map((el) => el.getAttribute("data-colour-swatch")),
    )) {
      await page.locator(`[data-colour-swatch="${hex}"]`).click();
      await page.waitForTimeout(7000);
    }
    const swatch = page.locator(`[data-colour-swatch="${colour}"]`);
    if ((await swatch.count()) === 0) throw new Error(`العرفة مش معروضة على ${path}: ${colour}`);
    await swatch.click();
    await page.waitForTimeout(7000);
  }

  const measured = await page.evaluate(() => {
    const line = document.querySelector("[data-region-line]");
    const room = document.querySelector("[data-family-room]");
    const swatches = [...document.querySelectorAll("[data-colour-swatch]")].map((el) => ({
      hex: el.getAttribute("data-colour-swatch"),
      on: el.getAttribute("data-colour-selected") === "1",
    }));
    return {
      line: line ? (line.textContent || "").replace(/\s+/g, " ").trim() : null,
      tier: line ? line.getAttribute("data-region-line") : null,
      order: room ? [...room.querySelectorAll("img")].map((im) => im.getAttribute("src") ?? "") : [],
      badge: document.querySelector("[data-picture-near]")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      swatches,
      chips: [...document.querySelectorAll("[data-area-chip]")].map((el) => el.getAttribute("data-area-chip")),
    };
  });
  return { page, ...measured };
}

/** A picture of the sheet where the claim is actually printed, not of its header. */
async function shoot(page, file) {
  const box = page.locator("[data-family-room]");
  if ((await box.count()) > 0) {
    await box.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await box.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file });
  }
}

const firstTen = (order) => order.slice(0, 10).map((src) => (src || "").split("/").pop() || src);

const addr = await addressOf([VIEWER_A, VIEWER_B, WITNESS_A, WITNESS_B, EMPTY_SEER]);
const log = (...a) => console.log(...a);

log("=== ١) شاشة من غير شاهد في منطقتها");
const blank118 = await readSheet(addr(VIEWER_A), { area: AREA_A });
log(`   الشارات المعروضة: ${blank118.chips.length}`);
log(`   السطر: ${blank118.line}`);
log(`   الطبقة: ${blank118.tier}`);
log(`     أول عشر: ${firstTen(blank118.order).join(", ")}`);
await shoot(blank118.page, `${SHOTS}/region-no-evidence.png`);
await blank118.page.close();

const blank119 = await readSheet(addr(VIEWER_B), { area: AREA_B });
log(`   السطر: ${blank119.line}`);
await blank119.page.close();

log("\n=== ٢) الشهود: كل ورقة تاخد منطقتها ولونها");
const w1 = await readSheet(addr(WITNESS_A), { area: AREA_A });
log(`   ورقة ${WITNESS_A}: منطقة ${AREA_A} اتقالت، ألوانها ${w1.swatches.filter((s) => s.on).length}`);
await w1.page.close();

// The matrix lists the bank's families in its own order, so its last swatch is the rarest one this
// room can show — a colour the other area does not carry, named once instead of recomputed per run.
const w2open = await readSheet(addr(WITNESS_B));
const free = w2open.swatches.filter((s) => !s.on).map((s) => s.hex);
const wanted = free[free.length - 1];
log(`   ورقة ${WITNESS_B}: أندر لون في مصفوفتها = ${wanted ?? "مفيش"}`);
await w2open.page.close();

const w2 = await readSheet(addr(WITNESS_B), { area: AREA_B, colour: wanted });
log(`   ألوانها المختارة دلوقتي: ${w2.swatches.filter((s) => s.on).map((s) => s.hex).join(" ") || "ولا لون"}`);
await w2.page.close();

log("\n=== ٣) نفس الشاشتين، والشاهد موجود");
const seen118 = await readSheet(addr(VIEWER_A));
log(`   ${VIEWER_A} (${AREA_A}): طبقة=${seen118.tier}`);
log(`     السطر: ${seen118.line}`);
log(`     أول عشر: ${firstTen(seen118.order).join(", ")}`);
await shoot(seen118.page, `${SHOTS}/region-area-taste.png`);
await seen118.page.close();

const seen119 = await readSheet(addr(VIEWER_B));
log(`   ${VIEWER_B} (${AREA_B}): طبقة=${seen119.tier}`);
log(`     السطر: ${seen119.line}`);
log(`     أول عشر: ${firstTen(seen119.order).join(", ")}`);
await shoot(seen119.page, `${SHOTS}/region-other-area.png`);
await seen119.page.close();
log(`   علامة على الصورة القريبة (${AREA_A}): ${seen118.badge ?? "ولا علامة"}`);
log(`   علامة على الصورة القريبة (${AREA_B}): ${seen119.badge ?? "ولا علامة"}`);

log("\n=== ٤) منطقة لسه ما فيهاش شاهد");
const lone = await readSheet(addr(EMPTY_SEER), { area: AREA_EMPTY });
log(`   ورقة ${EMPTY_SEER}: طبقة=${lone.tier}`);
log(`     السطر: ${lone.line}`);
log(`     علامة قرب الصورة: ${lone.badge ?? "ولا علامة"}`);
await shoot(lone.page, `${SHOTS}/region-no-evidence.png`);
await lone.page.close();

log("\n=== الحكم");
// The two viewers hold no room of their own, so both get the general house set in the bank's own
// quality order: identical input. If their lists come out in different sequences, the area is what
// moved them. The baseline line only means anything on a run that starts with empty areas.
const sameSet = JSON.stringify([...seen118.order].sort()) === JSON.stringify([...seen119.order].sort());
const sameOrder = JSON.stringify(firstTen(seen118.order)) === JSON.stringify(firstTen(seen119.order));
log(`   نفس الصور عند المنطقتين، يعني دخل متساوي؟ ${sameSet ? "أيوه" : "لأ — فيه صور اختلفت كمان"}`);
log(`   منطقتان مختلفتان وترتيب مختلف؟ ${sameOrder ? "لأ — الترتيب واحد، والرادار ما فرّقش" : "أيوه"}`);
log(`   عدد الأخطاء في الكونسول: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 5)) log(`     • ${e}`);

const { data: stored } = await db
  .from("room_sketches")
  .select("id,customer_city,colour_picks")
  .in("id", [VIEWER_A, VIEWER_B, WITNESS_A, WITNESS_B, EMPTY_SEER])
  .order("id");
log("\n=== اللي في السجل نفسه");
for (const r of stored ?? []) {
  log(`   ورقة ${r.id}: منطقة «${r.customer_city ?? "فاضية"}» · ألوان ${(r.colour_picks ?? []).map((p) => p.hex).join(" ") || "ولا لون"}`);
}

await b.close();
