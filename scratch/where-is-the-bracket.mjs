import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Where on the cockpit screen does a dead markdown link still reach the eye?
 *
 * The renderer fix went out, and the bracket is still on the page. Two readings: the build has not
 * landed, or the text never passes through the renderer at all — the employee cards print a one-line
 * teaser of the last stored row, and a teaser is plain text. This prints the element's own ancestry
 * so the answer is read, not argued.
 *
 *   node scratch/where-is-the-bracket.mjs
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

await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
await p.waitForTimeout(14000);

const found = await p.evaluate(() => {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (!text.includes("رابط غير موثق")) continue;
    const el = node.parentElement;
    if (!el) continue;
    const chain = [];
    let cur = el;
    for (let i = 0; i < 6 && cur; i++) {
      chain.push(`${cur.tagName.toLowerCase()}.${String(cur.className).split(/\s+/).slice(0, 3).join(".")}`);
      cur = cur.parentElement;
    }
    out.push({ text: text.slice(0, 90), chain: chain.join(" < "), dataAttrs: Object.keys(el.dataset ?? {}).join(",") });
  }
  return out;
});
console.log(`مواضع الجملة على الشاشة: ${found.length}`);
for (const f of found) console.log(`  «${f.text}»\n    ${f.chain}\n    data: ${f.dataAttrs || "—"}`);
await p.screenshot({ path: "scratch/where-bracket-390.png" });
await b.close();
