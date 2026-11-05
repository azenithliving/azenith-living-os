import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import speakeasy from "speakeasy";

/**
 * Are his addresses said as places now?
 *
 * Waits for the build that labels a path link in Arabic — a link whose text is Arabic and whose
 * address is a site path is something the previous build could not print — and then counts what is
 * left: links still showing a raw path, and the Latin words on the cockpit screen.
 *
 *   node scratch/proof-place-labels.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const AR = /[٠-٩\u0600-\u06FF]/;

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 120)));

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

let live = false;
for (let attempt = 0; attempt < 30 && !live; attempt++) {
  await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(10000);
  const seen = await p.evaluate(() =>
    [...document.querySelectorAll("a")]
      // The marker has to be a link only this build can print: a path address, opened in a new tab,
      // whose label is Arabic. Ordinary navigation links look Arabic too, so `target` is what tells
      // them apart — the first version of this check counted those and said "new build" too early.
      .filter((a) => (a.getAttribute("href") ?? "").startsWith("/") && a.getAttribute("target") === "_blank")
      .map((a) => (a.textContent ?? "").trim())
      .filter((t) => /[٠-٩\u0600-\u06FF]/.test(t) && !/[A-Za-z]{3,}/.test(t)).length,
  );
  live = seen > 0;
  console.log(live ? `النسخة الجديدة شغالة: ${seen} عنوان مسمّى بمكانه` : `مستني النسخة الجديدة (${attempt + 1})`);
  if (!live) await p.waitForTimeout(20000);
}
if (!live) console.log("العلامة ما ظهرتش — الأرقام دي من النسخة القديمة");

const answer = await p.evaluate(() => {
  const links = [...document.querySelectorAll("a")]
    .filter((a) => (a.getAttribute("href") ?? "").startsWith("/"))
    .map((a) => ({ text: (a.textContent ?? "").trim(), href: a.getAttribute("href") ?? "", target: a.getAttribute("target") ?? "" }));
  const latinWords = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 2 || !/[٠-٩\u0600-\u06FF]/.test(text)) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === "none" || rect.width < 1 || rect.height < 1) continue;
    for (const w of text.match(/[A-Za-z]{3,}/g) ?? []) latinWords.add(w);
  }
  return {
    labeled: links.filter((l) => l.target === "_blank" && /[٠-٩\u0600-\u06FF]/.test(l.text) && !/[A-Za-z]{3,}/.test(l.text)).length,
    rawPaths: links.filter((l) => l.href.startsWith("/") && l.text.startsWith("/")).length,
    addresses: links.filter((l) => l.text.startsWith("http")).length,
    latin: [...latinWords].sort(),
    rawKinds: (() => {
      const out = { code: 0, strong: 0, td: 0, plain: 0, samples: [] };
      for (const a of [...document.querySelectorAll("a")]) {
        const href = a.getAttribute("href") ?? "";
        const text = (a.textContent ?? "").trim();
        if (!href.startsWith("/") || !text.startsWith("/")) continue;
        if (a.closest("code")) out.code += 1;
        else if (a.closest("strong")) out.strong += 1;
        else if (a.closest("td,th")) out.td += 1;
        else {
          out.plain += 1;
          if (out.samples.length < 5) out.samples.push(`${text.slice(0, 30)} << ${a.outerHTML.slice(0, 110)}`);
        }
      }
      return out;
    })(),
  };
});
console.log(`عناوين مسماة: ${answer.labeled} · مسار خام لسه: ${answer.rawPaths} · عنوان ويب كامل (مسموح): ${answer.addresses} · كلمات لاتينية على الشاشة: ${answer.latin.length}`);
console.log(`اللاتيني الباقي: ${answer.latin.slice(0, 14).join(" ، ")}`);
console.log(`المسارات الخام في: كود ${answer.rawKinds.code} · غامق ${answer.rawKinds.strong} · جدول ${answer.rawKinds.td} · نص عادي ${answer.rawKinds.plain}`);
for (const s of answer.rawKinds.samples) console.log(`   عينة: ${s}`);
console.log(`أخطاء كونسول: ${errors.length}`);
for (const e of errors.slice(0, 3)) console.log(`   ${e}`);
await p.screenshot({ path: "scratch/place-labels-390.png" });
await b.close();
