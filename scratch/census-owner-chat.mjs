import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";
import fs from "node:fs";

/**
 * What Latin actually reaches the owner's chat screen — measured in the browser, not in the source.
 *   node scratch/census-owner-chat.mjs [base]
 *
 * The owner reads Arabic only; every word of another language on his screen is a defect, and so is
 * every digit spelled the other way. This counts both, and names the bubble they sit in.
 */
const BASE = process.argv[2] ?? "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z]/.test(l) && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "").trim()]),
);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 70)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i += 1) await p.waitForTimeout(1500);
console.log("داخل؟", p.url().includes("/admin") ? "أيوه" : "لأ");

for (const route of ["/admin/v2/sales", "/admin/v2/ops"]) {
  // Count only what this page itself raised: clear the list, load, let it settle, then read.
  errors.length = 0;
  await p.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(16000);
  const found = await p.evaluate(() => {
    const words = [];
    const digitLines = [];
    for (const el of document.querySelectorAll("main *")) {
      if (el.closest("a, code, pre, script, style, svg")) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3)) continue;
      if (!el.getClientRects().length) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      // An email or a web address is allowed on his screen as its own element — judge the prose.
      const prose = t.replace(/[\w.+-]+@[\w.-]+\.\w+/g, " ").replace(/https?:\/\/\S+/g, " ");
      const w = prose.match(/[A-Za-z]{3,}/g);
      if (w && !/^(https?|div|span)$/.test(w[0])) words.push(`${[...new Set(w)].join(",")} ⟵ ${t.slice(0, 70)}`);
      if (/[\u0600-\u06FF]/.test(prose) && /(?<![A-Za-z0-9])[0-9]{1,3}(?![A-Za-z0-9])/.test(prose)) digitLines.push(t.slice(0, 70));
    }
    return { words: [...new Set(words)], digitLines: [...new Set(digitLines)] };
  });
  console.log(`\n=== ${route} · ${found.words.length} فقاعة تحمل كلمة لاتينية · ${found.digitLines.length} سطر يحمل رقم لاتيني`);
  for (const w of found.words.slice(0, 12)) console.log("  كلمة • " + w);
  for (const d of found.digitLines.slice(0, 8)) console.log("  رقم • " + d);
  await p.screenshot({ path: `scratch/owner-chat-${route.split("/").pop()}.png`, fullPage: false });
}
console.log("\nأخطاء الكونسول:", errors.length, errors.slice(0, 2).join(" | "));
await b.close();
