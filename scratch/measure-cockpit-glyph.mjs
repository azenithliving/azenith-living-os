import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(1 + l.indexOf("=")).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();

try {
  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.fill('input[type="email"]', env.ADMIN_GATE_EMAIL);
  await page.fill('input[type="password"]', env.ADMIN_GATE_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !String(u).includes("/gate/login"), { timeout: 40000 }).catch(() => {});
  await page.goto(`${SITE}/admin/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(9000);

  const found = await page.evaluate(() => {
    const odd = [];
    for (const node of document.querySelectorAll("*")) {
      if (node.children.length > 0) continue;
      const text = (node.textContent || "").trim();
      if (text === "") continue;
      // anything that is not Arabic letters, Arabic-Indic digits, or plain punctuation
      if (/[\uFFFD\u25C6\u2022\u00B7]/.test(text) || !/[\u0600-\u06FF0-9\uFF10-\uFF19\s]/.test(text)) {
        odd.push({
          text: text.slice(0, 40),
          points: Array.from(text.slice(0, 12)).map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase()).join(" "),
          cls: String(node.className || "").slice(0, 60),
          tag: node.tagName,
        });
      }
    }
    return odd.slice(0, 25);
  });
  say("odd nodes=" + found.length);
  for (const f of found) say(`  [${f.tag} .${f.cls}] "${f.text}" :: ${f.points}`);

  await page.screenshot({ path: "scratch/cockpit-glyph-390.png", fullPage: false });
} catch (e) {
  say("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await browser.close();
  writeFileSync("scratch/measure-cockpit-glyph.out", lines.join("\n") + "\n");
}
