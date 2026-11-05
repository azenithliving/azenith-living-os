import { chromium } from "@playwright/test";

/**
 * When a customer's phone asks the published site for pictures, how long do they take?
 * Measured in the browser with the page's own timing records, at his width, on a cold cache.
 */
const BASE = "https://azenith-living.vercel.app";
const PAGES = ["/rooms/living-room", "/furniture"];

const b = await chromium.launch({ headless: true });
for (const path of PAGES) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(9000);
  const timing = await p.evaluate(() => {
    const imgs = performance.getEntriesByType("resource").filter((e) => e.initiatorType === "img" || /\.(jpg|jpeg|webp|png)/i.test(e.name));
    const ms = imgs.map((e) => ({ name: e.name.split("/").slice(-1)[0].slice(0, 24), dur: Math.round(e.duration), size: e.transferSize }));
    const paint = performance.getEntriesByType("paint").map((e) => ({ name: e.name, at: Math.round(e.startTime) }));
    const lcp = (performance.getEntriesByType("largest-contentful-paint") || []).map((e) => Math.round(e.startTime));
    return { count: ms.length, rows: ms, paint, lcp };
  });
  const durs = timing.rows.map((r) => r.dur).sort((a, c) => a - c);
  const med = durs.length ? durs[Math.floor(durs.length / 2)] : 0;
  const p95 = durs.length ? durs[Math.min(durs.length - 1, Math.floor(durs.length * 0.95))] : 0;
  const over = durs.filter((d) => d > 500).length;
  const totalBytes = timing.rows.reduce((a, r) => a + (r.size || 0), 0);
  console.log(
    `${path}: ${timing.count} pictures · median ${med} ms · p95 ${p95} ms · over half a second: ${over} · transferred ${(totalBytes / 1024 / 1024).toFixed(2)} ميجابايت · ` +
      `first paint ${timing.paint.find((x) => x.name === "first-contentful-paint")?.at ?? "?"} ms · LCP ${timing.lcp[0] ?? "?"} ms`
  );
  await ctx.close();
}
await b.close();
