import { chromium } from "@playwright/test";

/**
 * What the customer's home page actually shows for room pictures.
 *
 * The page prefers a stored CMS image and only falls back to the live photo library when there is
 * none — and every stored section points at one address that answers 404. This measures whether that
 * dead address is really being put in front of a customer, by counting the images the browser could
 * not decode, instead of reasoning about it.
 *
 *   node scratch/census-home-images.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();

const deadRequests = [];
p.on("requestfinished", async (req) => {
  if (/images\.unsplash\.com/.test(req.url())) {
    try {
      deadRequests.push(req.response ? (await req.response()).status() : 0);
    } catch {
      deadRequests.push(-1);
    }
  }
});

const sections = await (async () => {
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  return p.evaluate(async () => {
    const res = await fetch("/api/room-sections");
    const body = await res.json();
    return (body.sections ?? []).map((s) => ({ slug: s.slug, image: s.cmsImageUrl, gallery: s.galleryImages?.length ?? 0 }));
  });
})();

console.log(`sections from the public door = ${sections.length}`);
for (const s of sections.slice(0, 16)) console.log(`  ${s.slug} · gallery=${s.gallery} · ${String(s.image).slice(0, 70)}`);

await p.waitForTimeout(14000);

const imgs = await p.evaluate(() => {
  const list = [...document.querySelectorAll("img")];
  return {
    total: list.length,
    broken: list
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => ({ src: (i.currentSrc || i.src || "").slice(0, 90), alt: (i.alt || "").slice(0, 40) }))
      .slice(0, 20),
    unsplash: list.filter((i) => /unsplash/.test(i.src)).length,
    pexels: list.filter((i) => /pexels/.test(i.src)).length,
  };
});

console.log(`\nhome page images: total=${imgs.total} · broken=${imgs.broken.length} · unsplash-sourced=${imgs.unsplash} · pexels-sourced=${imgs.pexels}`);
for (const bad of imgs.broken) console.log(`  broken: ${bad.src}  alt="${bad.alt}"`);
console.log(`requests to the dead unsplash address = ${deadRequests.length} ${JSON.stringify(deadRequests.slice(0, 8))}`);

await p.screenshot({ path: "scratch/home-images-390.png" });
await b.close();
