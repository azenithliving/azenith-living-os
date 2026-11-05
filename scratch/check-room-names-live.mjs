import { chromium } from "@playwright/test";

/**
 * Live proof for the room-name atom, on the published site at 390px — read-only, no sign-in,
 * no row written. Three surfaces that name the same rooms must answer with the same words.
 *   node scratch/check-room-names-live.mjs [base]
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";

const EXPECT = {
  "/rooms/living-room": "غرف المعيشة والصالات",
  "/rooms/entrance-lobby": "المدخل والريسبشن",
  "/rooms/guest-bathroom": "حمامات الضيوف",
  "/rooms/teen-room": "غرف المراهقين",
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 80)));

for (const [path, want] of Object.entries(EXPECT)) {
  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(5000);
  const seen = await p.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const title = document.title;
    const bodyHas = (t) => document.body.innerText.includes(t);
    return { h1, title, hasOldLiving: bodyHas("غرف المعيشة\n") };
  });
  const ok = seen.h1.includes(want) || seen.title.includes(want);
  console.log(`${path}\n   مطلوب: «${want}» · العنوان الحيّ: «${seen.h1}» · وسم الصفحة: «${seen.title}» → ${ok ? "موافق" : "مخالف"}`);
}

await p.goto(`${BASE}/request`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(7000);
const chips = await p.evaluate(() => {
  const text = document.body.innerText;
  return {
    living: text.includes("غرف المعيشة والصالات"),
    wholeHome: text.includes("المنزل بالكامل"),
    oldOnly: /غرف المعيشة(?!\s*و)/.test(text),
    landscape: text.includes("لاندسكيب"),
  };
});
console.log(`\n/request — «غرف المعيشة والصالات»: ${chips.living ? "موجود" : "مفيش"} · «المنزل بالكامل»: ${chips.wholeHome ? "موجود" : "مفيش"} · الاسم القديم لوحده: ${chips.oldOnly ? "لقيانه (ده الغلط)" : "مفيش"} · اللاندسكيب سايب اسمه: ${chips.landscape ? "أيوه" : "لأ"}`);
await p.screenshot({ path: "scratch/room-names-request.png" });

await p.goto(`${BASE}/elite-brief`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(7000);
const elite = await p.evaluate(() => document.body.innerText.includes("غرف المعيشة والصالات"));
console.log(`/elite-brief — بيقول نفس الاسم: ${elite ? "أيوه" : "لأ"}`);
await p.screenshot({ path: "scratch/room-names-elite.png" });

console.log(`\nأخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 3).join(" || ") : ""}`);
await b.close();
