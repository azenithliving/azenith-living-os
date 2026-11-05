/**
 * measure-card-bidi.mjs — which way the alert card's count line actually lays out.
 *
 * A line that starts with a digit can pick up left-to-right base direction, which reads scrambled
 * to an Arabic reader even when every glyph is correct. This asks the browser where the digit lands.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const dash = await ctx.newPage();
  await dash.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await dash.waitForTimeout(9000);

  const shape = await dash.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent?.includes("أهم التنبيهات"));
    const box = h?.parentElement;
    if (!box) return null;
    const p = [...box.querySelectorAll("p")].find((el) => /على الشاشة/.test(el.textContent || ""));
    if (!p) return null;
    const range = document.createRange();
    range.selectNodeContents(p);
    const node = p.firstChild;
    const rects = Array.from(range.getClientRects()).map((r) => ({ x: Math.round(r.x), w: Math.round(r.width) }));
    const digitRect = (() => {
      const dr = document.createRange();
      if (node && node.textContent) {
        dr.setStart(node, 0);
        dr.setEnd(node, 1);
        const r = dr.getBoundingClientRect();
        return { x: Math.round(r.x), right: Math.round(r.right) };
      }
      return null;
    })();
    const first = p.textContent.trim().charAt(0);
    const word = (p.textContent.match(/الشاشة/) || [])[0];
    const wordRange = document.createRange();
    const idx = node && node.textContent ? node.textContent.indexOf(word) : -1;
    if (node && idx >= 0) {
      wordRange.setStart(node, idx);
      wordRange.setEnd(node, idx + word.length);
    }
    const wr = wordRange.getBoundingClientRect();
    return {
      firstChar: first,
      isDigitFirst: /[٠-٩0-9]/.test(first),
      digitX: digitRect ? digitRect.x : null,
      digitRight: digitRect ? digitRect.right : null,
      wordX: Math.round(wr.x),
      wordRight: Math.round(wr.right),
      dirAttr: p.getAttribute("dir"),
      computedDir: getComputedStyle(p).direction,
    };
  });
  say("SHAPE=" + JSON.stringify(shape));
  if (shape) {
    const digitIsRightmost = shape.digitX !== null ? shape.digitX > shape.wordX : null;
    say("DIGIT_RIGHT_OF_WORDS=" + String(digitIsRightmost));
    say("COMPUTED_DIRECTION=" + shape.computedDir + " dirAttr=" + String(shape.dirAttr));
  }
} finally {
  await browser.close();
  writeFileSync("scratch/measure-card-bidi.out", out.join("\n") + "\n");
}
