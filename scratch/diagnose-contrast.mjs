import { chromium } from "@playwright/test";

/**
 * Diagnostic, not a finding: what do the computed colours on the published page actually look like?
 *
 * The contrast pass reported 1:1 for almost every text node, which is the signature of an instrument
 * that cannot see the background rather than of a site written in white on white. This prints the raw
 * computed values for a handful of real text nodes and the chain behind them, so the fix is decided by
 * data.
 *
 *   node scratch/diagnose-contrast.mjs
 */
const BASE = "https://azenith-living.vercel.app";

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(12000);

const dump = await p.evaluate(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out = [];
  let node;
  while ((node = walker.nextNode()) && out.length < 6) {
    const text = (node.nodeValue ?? "").trim();
    if (text.length < 3) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === "none") continue;
    const chain = [];
    let cur = el;
    for (let depth = 0; cur && depth < 6; depth++) {
      const cs = getComputedStyle(cur);
      chain.push({
        tag: cur.tagName.toLowerCase(),
        cls: String(cur.className ?? "").slice(0, 40),
        bg: cs.backgroundColor,
        image: cs.backgroundImage.slice(0, 30),
      });
      cur = cur.parentElement;
    }
    out.push({ text: text.slice(0, 30), color: style.color, size: style.fontSize, chain });
  }
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    samples: out,
  };
});

console.log(JSON.stringify(dump, null, 1));
await b.close();
