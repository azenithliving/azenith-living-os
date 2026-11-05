import { chromium } from "@playwright/test";

/**
 * The storefront's room pictures, measured on the published site at the owner's width.
 *
 * The claim is narrow and testable: two visitors, two loads, the same picture for the same room — and
 * most of those pictures come from the store's own bank instead of a fresh external query. The cards
 * are read through their links (each one carries the room and the style being shown), and the pictures
 * are unwrapped from the image optimiser so the address behind them can be compared with the bank's
 * answer.
 *
 *   node scratch/prove-room-covers-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";

async function readPage(b) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
  const calls = { pexels: 0, covers: 0, sections: 0, broken: 0 };
  p.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/pexels")) calls.pexels += 1;
    if (url.includes("/api/room-covers")) calls.covers += 1;
    if (url.includes("/api/room-sections")) calls.sections += 1;
  });
  const errors = [];
  p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  // The cards are lazy below the fold, so the page is walked before anything is counted.
  await p.waitForFunction(
    () => document.querySelectorAll('a[href^="/rooms/"] img').length >= 12,
    null,
    { timeout: 60000 }
  );
  for (let step = 0; step < 8; step++) {
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(900);
  }
  await p
    .waitForFunction(
      () => [...document.querySelectorAll('a[href^="/rooms/"] img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 10,
      null,
      { timeout: 45000 }
    )
    .catch(() => console.log("  (fewer pictures than expected finished loading — counted below)"));
  await p.waitForTimeout(3000);

  const cards = await p.evaluate(() => {
    const links = [...document.querySelectorAll('a[href^="/rooms/"]')];
    return links.map((a) => {
      const img = a.querySelector("img");
      const raw = img?.getAttribute("src") ?? "";
      let src = raw;
      if (raw.startsWith("/_next/image")) {
        try {
          src = new URL(raw, location.origin).searchParams.get("url") ?? raw;
        } catch {
          /* keep the raw address */
        }
      }
      return { href: a.getAttribute("href"), src, loaded: Boolean(img && img.complete && img.naturalWidth > 0) };
    });
  });
  const bank = await p.evaluate(async () => {
    const res = await fetch("/api/room-covers");
    return res.json();
  });

  await p.close();
  return { cards, bank, calls, errors };
}

const b = await chromium.launch({ headless: true });

// Wait for the deploy: the door is the marker, because on the old build it does not exist at all.
{
  const probe = await (await b.newContext()).newPage();
  // An absolute address: the probe page never navigates, so a relative fetch has no origin to resolve.
  await probe.goto(`${BASE}/robots.txt`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  for (let attempt = 0; attempt < 45; attempt++) {
    const answer = await probe.evaluate(async (url) => {
      try {
        const res = await fetch(url);
        const body = await res.json().catch(() => null);
        return { status: res.status, cells: body?.cells ?? null, ok: body?.ok ?? null };
      } catch {
        return { status: 0, cells: null, ok: null };
      }
    }, `${BASE}/api/room-covers`);
    if (answer.ok === true && answer.cells > 0) {
      console.log(`door live: cells = ${answer.cells} (attempt ${attempt + 1})`);
      break;
    }
    console.log(`waiting for the new build (attempt ${attempt + 1}) — door status ${answer.status}`);
    await probe.waitForTimeout(20000);
  }
  await probe.close();
}

const first = await readPage(b);
const second = await readPage(b);
await b.close();

const style = (first.cards[0]?.href ?? "").match(/style=([a-z]+)/)?.[1] ?? "modern";
const bankForStyle = first.bank.covers?.[style] ?? {};
const keyOf = (href) => String(href ?? "").replace(/^\/rooms\/|\.|\?.*$/g, "") || "interior-design";

console.log(`style shown = ${style} · cards = ${first.cards.length} · bank cells for this style = ${Object.keys(bankForStyle).length}`);
console.log(`door answered rooms=${first.bank.rooms} cells=${first.bank.cells} ok=${first.bank.ok}`);

let fromBank = 0;
let identical = 0;
let broken = 0;
for (const card of first.cards) {
  const room = keyOf(card.href);
  const other = second.cards.find((c) => c.href === card.href);
  const same = other?.src === card.src;
  if (same) identical += 1;
  if (!card.loaded) broken += 1;
  const isBank = Object.entries(bankForStyle).some(([slug, url]) => (slug === room || (room === "interior-design" && slug === "interior-design")) && url === card.src);
  if (isBank) fromBank += 1;
  console.log(`  ${room.padEnd(18)} ${isBank ? "bank  " : "other "} ${same ? "same on reload" : "CHANGED — defect"} · loaded=${card.loaded} · ${String(card.src).slice(0, 46)}`);
}

console.log(`\npictures from the store's own bank = ${fromBank} of ${first.cards.length}`);
console.log(`same picture on the second load = ${identical} of ${first.cards.length}`);
console.log(`pictures that did not decode = ${broken}`);
console.log(`external photo calls per load: first = ${first.calls.pexels}, second = ${second.calls.pexels}`);
console.log(`bank door calls per load: ${first.calls.covers}, ${second.calls.covers} · dead section door calls: ${first.calls.sections}`);
console.log(`console errors: ${first.errors.length + second.errors.length}${first.errors.length ? ` — ${first.errors.join(" | ")}` : ""}`);
