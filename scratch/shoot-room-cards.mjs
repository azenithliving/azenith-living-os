import { chromium } from "@playwright/test";

/**
 * One look at the room cards on the published phone screen, after the bank became their source.
 *
 * The counts are already measured; this is the picture — do the cards show real rooms, in the style
 * the switcher says, with nothing broken and no machine address printed where a customer reads Arabic.
 *
 *   node scratch/shoot-room-cards.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForFunction(() => document.querySelectorAll('a[href^="/rooms/"] img').length >= 12, null, { timeout: 60000 });
for (let step = 0; step < 8; step++) {
  await p.mouse.wheel(0, 800);
  await p.waitForTimeout(900);
}

const facts = await p.evaluate(() => {
  const grid = document.querySelector('a[href^="/rooms/"]')?.closest(".grid");
  if (!grid) return null;
  grid.scrollIntoView({ block: "start" });
  const cards = [...grid.querySelectorAll('a[href^="/rooms/"]')];
  return {
    cards: cards.length,
    titles: cards.slice(0, 6).map((a) => (a.getAttribute("data-telemetry") ?? "").replace("غرفة: ", "")),
    broken: cards.filter((a) => { const i = a.querySelector("img"); return i && (!i.complete || i.naturalWidth === 0); }).length,
    latinInAlt: cards.filter((a) => { const i = a.querySelector("img"); return i && /[A-Za-z]{3,}/.test(i.getAttribute("alt") ?? ""); }).length,
  };
});
console.log(JSON.stringify(facts, null, 1));
console.log(`console errors = ${errors.length}${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await p.waitForTimeout(1200);
if (facts) {
  const handle = await p.evaluateHandle(() => document.querySelector('a[href^="/rooms/"]')?.closest(".grid") ?? null);
  const element = handle.asElement();
  if (element) await element.screenshot({ path: "scratch/room-cards-390.png" });
}
await b.close();
