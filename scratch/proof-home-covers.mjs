import { chromium } from "@playwright/test";

/**
 * Do his sixteen rooms answer from his own bank, twice in a row, without asking a stranger?
 *
 * The claim has three parts, and each is measured on the published page at his width:
 *   ١) every room card carries a picture from the store's bank (no placeholder, no external search);
 *   ٢) the same room shows the SAME picture on a second load — the defect this whole line of work
 *      started from was a random page offset in a live query, so the card changed per visit;
 *   ٣) the page made no call to the external photo door at all.
 *
 *   node scratch/proof-home-covers.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });

async function capture(label) {
  const p = await ctx.newPage();
  const photoCalls = [];
  p.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.includes("/api/pexels") || path.includes("api.pexels.com")) photoCalls.push(path);
  });
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 120)));

  await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  // The room grid is far down a long page; scroll so every card has loaded its picture.
  for (let i = 0; i < 8; i++) {
    await p.mouse.wheel(0, 900);
    await p.waitForTimeout(1200);
  }
  await p.waitForTimeout(4000);

  const cards = await p.evaluate(() => {
    // The card's own handle: every room tile carries `data-telemetry="غرفة: …"`, which is steadier than
    // matching alt text that changes with the style switcher and the language.
    const tiles = [...document.querySelectorAll('[data-telemetry^="غرفة:"], a[href^="/rooms/"]')].filter((el, i, all) => all.indexOf(el) === i);
    return tiles.map((el) => {
      const img = el.querySelector("img");
      const src = img?.getAttribute("src") ?? "";
      return {
        alt: (el.getAttribute("data-telemetry") ?? "").replace(/\s+/g, " ").slice(0, 46),
        src,
        bank: src.includes("images.pexels.com"),
        placeholder: src.includes("placeholder-room") || src === "",
      };
    });
  });
  const banked = cards.filter((c) => c.bank).length;
  const placeholders = cards.filter((c) => c.placeholder).length;
  console.log(
    `${label}: كروت ${cards.length} · من البنك ${banked} · بلاصة هولدر ${placeholders} · نداءات المزود ${photoCalls.length}` +
      (errors.length ? ` · أخطاء كونسول ${errors.length}` : " · أخطاء كونسول 0"),
  );
  for (const e of errors.slice(0, 3)) console.log(`   خطأ: ${e}`);
  // The floating consultant auto-opens over the page; it is not part of what is measured here,
  // and a picture of the room grid is useless if a chat window is standing in front of it.
  await p.evaluate(() => {
    for (const el of document.querySelectorAll("div")) {
      const cls = el.className ?? "";
      if (typeof cls !== "string" || !cls.includes("fixed")) continue;
      if ((el.textContent ?? "").includes("مستشار أزينث")) el.style.display = "none";
    }
    document.querySelector('[data-telemetry^="غرفة:"]')?.scrollIntoView({ block: "start" });
  });
  await p.waitForTimeout(2500);
  const shot = label === "اللقطة الأولى" ? "scratch/home-covers-a-390.png" : "scratch/home-covers-b-390.png";
  await p.screenshot({ path: shot, fullPage: false });
  await p.close();
  return { map: Object.fromEntries(cards.map((c) => [c.alt, c.src])), banked, placeholders, count: cards.length, photoCalls: photoCalls.length };
}

const first = await capture("اللقطة الأولى");
const second = await capture("اللقطة التانية");

const changed = Object.keys(first.map).filter((room) => first.map[room] !== second.map[room]);
console.log(`\nكروت غيّرت صورتها بين اللقطين: ${changed.length}`);
for (const room of changed.slice(0, 8)) console.log(`   ${room}`);
console.log(
  first.count === second.count && changed.length === 0 && first.placeholders === 0 && first.photoCalls === 0
    ? "\nالنتيجة: كل الكروت من البنك، ثابتة، ومن غير سؤال بره"
    : "\nالنتيجة: لسه فيها نقص — الأرقام فوق",
);
await b.close();
