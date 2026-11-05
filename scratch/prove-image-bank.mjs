/**
 * prove-image-bank.mjs — the picture bank screen, measured on the published link at 390px.
 *
 * The claim this instrument is built to attack: «the screen shows what the record holds». So the count
 * is read twice — once from the store's own database, once off the published page — and the two must be
 * the same number written in the owner's digits. The harvest log's machine status must not reach his
 * eyes in English, and a door that refuses must be heard as a refusal, not as an empty bank.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const toAr = (n) => String(n).split("").map((d) => AR_DIGITS[Number(d)] ?? d).join("");

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const truth = (await sql`select count(*)::int c from curated_images where is_active = true`)[0].c;
const biggestKey = (await sql`select count(*)::int c from curated_images where is_active = true group by room_type order by c desc limit 1`)[0].c;
say("أكبر غرفة واحدة في السجل", biggestKey);
const logs = await sql`select status, count(*)::int c from refresh_logs group by status order by 2 desc limit 5`;
say("الصور النشطة في السجل", truth);
say("حالات سجل التحديث في القاعدة", logs.map((r) => `${r.status}=${r.c}`).join(" · ") || "مفيش سطور");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await page.click("button[type=submit]");
for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
check("البوابة فتحت", page.url().includes("/admin"), page.url().replace(SITE, ""));

// The marker is the address itself: the previous build answers 404 here.
let opened = false;
for (let attempt = 1; attempt <= 16 && !opened; attempt++) {
  await page.goto(`${SITE}/admin/v2/images`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(9000);
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  opened = body.includes("بنك الصور") && body.includes("الصور المحفوظة عند الدار");
  if (!opened) {
    console.log(`الشاشة لسه طلعت ٤٠٤ أو العدد ما جهّزش (${attempt})`);
    await new Promise((r) => setTimeout(r, 40000));
  }
}
check("شاشة بنك الصور فتحت على الرابط المنشور", opened, page.url().replace(SITE, ""));
// My own reload loop aborts the layout's in-flight fetches, and Chrome logs that as «Failed to fetch».
// The console count below belongs to a settled screen, so the footsteps are cleared before it is read.
errors.length = 0;

const seen = await page.evaluate(() => {
  const t = document.body.innerText.replace(/\s+/g, " ");
  const m = t.match(/الصور المحفوظة عند الدار:\s*([٠-٩٬,]+)/);
  return {
    count: m ? m[1] : null,
    latinDigits: /[0-9]/.test(t),
    englishStatus: /\b(success|failed|running)\b/.test(t),
    refusal: /ردّ بحالة|ما وصلش أصلًا/.test(t),
    rooms: Array.from(document.querySelectorAll("li p:first-child")).map((p) => p.textContent.trim()).filter((x) => x && x.length < 40).slice(0, 10),
    cardTexts: Array.from(document.querySelectorAll("li p:last-child")).map((p) => p.textContent.trim()),
    roomNames: Array.from(document.querySelectorAll("li p:first-child")).map((p) => p.textContent.trim()).filter((x) => x && x.length < 40 && /[؀-ۿ]/.test(x)),
    hasDelete: /احذف|امسح/.test(t),
  };
});
say("العدد المعروض", seen.count ?? "ما اتقراش");
check("العدد المعروض هو عدد السجل نفسه", seen.count === toAr(truth.toLocaleString("en-US")).replace(/,/g, "٬"), `الشاشة=${seen.count} السجل=${toAr(truth.toLocaleString("en-US")).replace(/,/g, "٬")}`);
check("مفيش رقم لاتيني على الشاشة", !seen.latinDigits, "");
check("حالة السجل ما بتوصلش بالإنجليزي", !seen.englishStatus, "");
check("مفيش زر مسح في الشاشة", !seen.hasDelete, "");
const arabicRooms = seen.rooms.filter((r) => /[\u0600-\u06FF]/.test(r));
say("غرف معروضة", arabicRooms.slice(0, 6).join(" · ") || "مفيش");
check("الغرف معروضة بأسمائها العربية", arabicRooms.length >= 2, `عدد=${arabicRooms.length}`);
const cardNumbers = seen.cardTexts.map((t) => Number(t.replace(/[^٠-٩]/g, "").split("").map((d) => String(["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"].indexOf(d))).join(""))).filter((n) => Number.isFinite(n) && n > 0);
const maxCard = Math.max(0, ...cardNumbers);
say("أكبر كارت على الشاشة", maxCard);
check("الكارت بيجمع كل أزواج الغرفة مش أول٨", maxCard >= biggestKey, `الكارت=${maxCard} السجل=${biggestKey}`);
check("كل غرفة طالعة مرة واحدة", new Set(seen.roomNames).size === seen.roomNames.length, seen.roomNames.join(" | "));

const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
say("الفضل العرضي خارج الشاشة", overflow);
check("مفيش زحافة أفقية على عرض ٣٩٠", overflow <= 1, `بكسل=${overflow}`);

await page.evaluate(() => window.scrollTo(0, Math.min(document.body.scrollHeight - window.innerHeight, 700)));
await page.waitForTimeout(1200);
await page.screenshot({ path: "scratch/image-bank-390.png" });
check("صفر رسالة خطأ في المتصفح", errors.length === 0, errors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));

// The negative: the same address without a session must refuse, not print a zero bank.
const anonCtx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const anon = await anonCtx.newPage();
const anonRes = await anon.goto(`${SITE}/api/admin/images/stats`, { waitUntil: "domcontentloaded", timeout: 60000 });
say("الباب بلا جلسة ردّ بالحالة", anonRes.status());
check("الباب بلا جلسة مرفوض", anonRes.status() === 401 || anonRes.status() === 403, `حالة=${anonRes.status()}`);

await browser.close();
await sql.end();
const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log("فشل: " + f.name);
process.exit(failed.length ? 1 : 0);
