/**
 * measure-card-glyphs.mjs — what characters are actually inside the cockpit's employee cards.
 *
 * A screenshot at 390px looked scrambled on one card. Before calling that a defect, the text is read
 * back from the live DOM and every non-Arabic code point is named with its position.
 */
import { readFileSync } from "node:fs";
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

  await page.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const cards = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("[class*=rounded], article, section"))
      .map((n) => (n.innerText || "").trim())
      .filter((t) => t.length > 24 && t.length < 600 && /وكيل|مدير|قائد/.test(t));
    return Array.from(new Set(nodes)).slice(0, 12);
  });
  say("cards read from the live DOM: " + cards.length);

  for (const text of cards) {
    const odd = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const cp = ch.codePointAt(0);
      const arabicLetter = cp >= 0x0600 && cp <= 0x06ff;
      const arabicDigit = cp >= 0x0660 && cp <= 0x0669;
      const layout = /[\s.,:;!?(){}\[\]/\\\-–—«»"'%+*=|_]/.test(ch);
      if (!arabicLetter && !arabicDigit && !layout) odd.push(`U+${cp.toString(16).toUpperCase()} "${ch}" at ${i}`);
    }
    const latinDigits = (text.match(/[0-9]/g) ?? []).length;
    say("== " + text.replace(/\s+/g, " ").slice(0, 70));
    say("   latin digits: " + latinDigits + " · other non-Arabic: " + (odd.length ? odd.slice(0, 12).join(" | ") : "none"));
  }
} finally {
  await browser.close().catch(() => {});
  console.log(out.join("\n"));
}
