/**
 * prove-snapshot-no-regression-390.mjs — the owner's screen after the nightly copy went in.
 *
 * The copy added no button and no line of his interface, so this proves the negative: at 390px on the
 * published link the cockpit still opens, still fits, still answers, and prints nothing red in the
 * console. A screenshot is taken because a number without a looked-at screen is not a proof here.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(4000);
await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await page.click("button[type=submit]");
for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
check("باب اللوحة بيفتح زي ما أمر", page.url().includes("/admin"), page.url().replace(BASE, ""));

await page.waitForTimeout(9000);
const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
say("طول الكلام على الشاشة", text.length);
check("الكابينة مش فاضية", text.length > 200, text.slice(0, 60));

const overflow = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  clientW: document.documentElement.clientWidth,
}));
say("العرض الكلي مقابل الشاشة", `${overflow.scrollW} مقابل ${overflow.clientW}`);
check("مفيش حاجة طالعة بره عرض الشاشة في اللوحة", overflow.scrollW <= overflow.clientW + 1, `فرق=${overflow.scrollW - overflow.clientW}`);

await page.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);
const composer = await page.evaluate(() => {
  const holder = document.querySelector("[data-chat-composer]");
  const field = holder?.querySelector("input, textarea") ?? holder;
  if (!field) return null;
  const box = field.getBoundingClientRect();
  return {
    x: Math.round(box.x),
    right: Math.round(box.right),
    w: Math.round(box.width),
    inView: box.width > 0 && box.x >= 0 && box.right <= window.innerWidth + 1,
  };
});
say("مربّع الكتابة", JSON.stringify(composer));
check("مربّع الكتابة داخل الشاشة عند عرض ٣٩٠", Boolean(composer?.inView), composer ? `من ${composer.x} إلى ${composer.right} عرض=${composer.w}` : "مفيش مربّع كتابة");

const headings = await page.locator("h1, h2, h3").count();
check("العناوين موجودة (الصفحة ما اتكسرتش)", headings > 0, "عدد=" + headings);
check("صفر رسالة خطأ في الكابينة", errors.length === 0, errors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));

await page.screenshot({ path: "scratch/snapshot-cockpit-390.png" });
await browser.close();

const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
process.exit(failed.length ? 1 : 0);
