import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The sales office at the owner's width, looked at rather than counted.
 *
 * The audit came back clean and the screenshot did not: a chat card in the middle of the screen has
 * chips sitting on top of its buttons, and the reply text carries a Latin word inside an Arabic
 * sentence. This prints what is actually stacked where, with the box of every element in the band, so
 * the defect is named by its owner component and not guessed from a picture.
 *
 *   node scratch/look-at-sales-card.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(4000);
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin/v2/sales`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

// The build marker is the repair itself: only the fixed badge wraps, so this waits for the new build
// rather than measuring whichever one the alias happens to be serving.
let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  live = await p.evaluate(() => Boolean(document.querySelector('[class*="gap-x-1.5"][class*="flex-wrap"]')));
  if (live) break;
  console.log(`waiting for the new build (attempt ${attempt + 1})`);
  await p.waitForTimeout(20000);
  await p.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await p.waitForTimeout(8000);
}
console.log(live ? "new build live (the desk badge wraps)" : "MARKER NEVER APPEARED — the pictures below are the old build");
await p.waitForTimeout(3000);
await p.screenshot({ path: "scratch/sales-full-390.png", fullPage: true });

const report = await p.evaluate(() => {
  const latin = /[A-Za-z]{3,}/g;
  const hits = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length < 3) continue;
    const words = text.match(latin) ?? [];
    const kept = words.filter((w) => !/^(https?|www|com|net)$/i.test(w));
    if (!kept.length) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) continue;
    hits.push({ words: kept.slice(0, 4), text: text.slice(0, 90), tag: el.tagName, cls: String(el.className).slice(0, 70) });
  }

  // Anything painted over something else inside the chat, which is what a stacked card looks like.
  // Only leaf text counts: two containers that merely share a row are not an overlap, and the first
  // version of this probe reported 205 of those.
  const overlaps = [];
  const boxes = [...document.querySelectorAll("button, span, p, a, code, strong")]
    .filter((el) => el.children.length === 0)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r, el }) => r.width > 10 && r.height > 8 && el.textContent && el.textContent.trim().length > 1);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const c = boxes[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const x = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left);
      const y = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
      if (x <= 0 || y <= 0) continue;
      const smaller = Math.min(a.r.width * a.r.height, c.r.width * c.r.height);
      if ((x * y) / smaller < 0.35) continue;
      overlaps.push({
        a: `${a.el.tagName}.${String(a.el.className).slice(0, 40)} «${a.el.textContent.trim().slice(0, 26)}»`,
        b: `${c.el.tagName}.${String(c.el.className).slice(0, 40)} «${c.el.textContent.trim().slice(0, 26)}»`,
        at: `${Math.round(Math.max(a.r.top, c.r.top))}`,
      });
    }
  }
  return { latin: hits.slice(0, 25), overlapCount: overlaps.length, overlaps: overlaps.slice(0, 12) };
});

console.log("=== كلمات لاتينية على شاشة المالك ===");
for (const h of report.latin) console.log(`  ${h.tag}.${h.cls} :: ${JSON.stringify(h.words)} :: «${h.text}»`);
console.log(`\n=== مواضع تراكب (${report.overlapCount}) ===`);
for (const o of report.overlaps) console.log(`  ي ${o.at}: ${o.a}  ⨯  ${o.b}`);
await b.close();
