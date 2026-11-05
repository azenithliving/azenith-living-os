import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * The two things the first proof left open, on a build that has finished settling.
 *
 * The published proof ran while the deploy was still rolling and reported four console errors, two of
 * them a script or style chunk refused because the server answered it as plain text — the shape a
 * stale HTML page referencing a replaced chunk makes. And one bracket-link mark was still printed
 * somewhere in the leader's chat. This re-opens the same two screens on the settled build, prints the
 * offending text node with its tag and its ancestry, and counts the console errors again.
 *
 *   node scratch/proof-rows-settled.mjs
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

for (const path of ["/admin/v2/agents/ops", "/admin/v2/sales"]) {
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 150)));
  p.on("pageerror", (e) => errors.push(String(e).replace(/\s+/g, " ").slice(0, 150)));

  await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  if ((await p.url()).includes("/gate/login")) {
    await p.waitForTimeout(4000);
    await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
    await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
    await p.click("button[type=submit]");
    await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
    const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
    await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
    await p.click("button[type=submit]");
    for (let i = 0; i < 20 && !(await p.url()).includes("/admin"); i++) await p.waitForTimeout(2000);
    await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  }
  await p.waitForTimeout(12000);

  const marks = await p.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
      if (!/[\][*]{2}|\]\(|\[\(/.test(text)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      out.push({ text: text.slice(0, 120), tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60) });
    }
    return out;
  });
  console.log(`\n${path} · علامات تنسيق باقية: ${marks.length} · أخطاء كونسول: ${errors.length}`);
  for (const m of marks.slice(0, 6)) console.log(`   <${m.tag} class="${m.cls}"> ${m.text}`);
  for (const e of errors.slice(0, 6)) console.log(`   خطأ: ${e}`);
  await p.screenshot({ path: `scratch/rows-settled-${path.split("/").pop()}-390.png` });
}
await b.close();
