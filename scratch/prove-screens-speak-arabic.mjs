/**
 * prove-screens-speak-arabic.mjs — his admin headings, measured on the published link at 390px.
 *
 * Claims under attack: «a heading on his screen says the thing once, in his language», and «the
 * thirteen English brackets that were removed are not printed anywhere on the rendered screens».
 * The scan reads the browser's own text, so a heading assembled at run time cannot hide from it —
 * and it counts the glosses, so a page that renders nothing is not mistaken for a clean page.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const lines = [];
const checks = [];
const say = (label, value) => { const s = `${label}: ${value}`; lines.push(s); console.log(s); };
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  const s = `${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`;
  lines.push(s);
  console.log(s);
};

const GLOSS_SCAN = `(() => {
  const AR = /[\\u0600-\\u06FF]/;
  const GLOSS = /\\(\\s*[A-Za-z][A-Za-z ]{2,}\\s*\\)/;
  const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,label,span,div,button')];
  const arabic = nodes.filter((n) => n.children.length === 0 && AR.test(n.textContent ?? ''));
  const glossed = arabic.filter((n) => GLOSS.test(n.textContent ?? '')).map((n) => (n.textContent ?? '').trim().slice(0, 60));
  return { arabicNodes: arabic.length, glossed };
})()`;

const DIGIT_SCAN = `(() => {
  const AR = /[\\u0600-\\u06FF]/;
  const nodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,label,span,div,button')];
  const arabic = nodes.filter((n) => n.children.length === 0 && AR.test(n.textContent ?? ''));
  const latinDigits = arabic.filter((n) => /\\d/.test(n.textContent ?? '')).map((n) => (n.textContent ?? '').trim().slice(0, 40));
  return { arabicNodes: arabic.length, latinDigits };
})()`;

let browser = null;

try {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${SITE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
  await page.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
  await page.click("button[type=submit]");
  for (let i = 0; i < 25 && !page.url().includes("/admin"); i++) await page.waitForTimeout(2000);
  check("البوابة فتحت", page.url().includes("/admin"), page.url().replace(SITE, ""));

  // ── his dashboard: the two headings that shipped with a bracket ───────────────────────────
  await page.goto(`${SITE}/admin/owner-dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const dash = await page.evaluate(GLOSS_SCAN);
  const dashText = await page.evaluate(() => document.body.innerText);
  check("لوحة المالك بتتكلم عربي كفاية يشوفها", dash.arabicNodes > 20, `عقد عربية ${dash.arabicNodes}`);
  check("عنوان الإنتاج بقى عربي بس", dashText.includes("ذكاء الإنتاج") && !dashText.includes("Production"),
    `حواشي ${dash.glossed.length}`);
  check("عنوان التدفق بقى عربي بس", dashText.includes("التدفق التشغيلي") && !dashText.includes("Operational"));
  check("مفيش ولا حاشية إنجليزية في قوس على اللوحة", dash.glossed.length === 0, JSON.stringify(dash.glossed).slice(0, 140));

  const digits = await page.evaluate(DIGIT_SCAN);
  check("أرقام اللوحة كلها بحروفه العربية", digits.latinDigits.length === 0, JSON.stringify(digits.latinDigits).slice(0, 160));

  const door = await page.evaluate(async () => {
    const res = await fetch("/api/admin/owner/dashboard", { cache: "no-store" });
    return await res.json().catch(() => null);
  });
  const raw = door?.data?.today?.pending_approvals;
  const expected = Number.isFinite(Number(raw)) ? new Intl.NumberFormat("ar-EG").format(Number(raw)) : null;
  say("الباب عدّ الموافقات", `${raw ?? "ما قالش"} → ${expected ?? "-"}`);
  check("الباب عدّ الموافقات", expected !== null, `قال ${JSON.stringify(raw)}`);
  check("واللوحة مطبوعة نفس العدد بحروفه العربية",
    expected !== null && dashText.includes(expected),
    `متوقع ${expected ?? "-"}`);
  await page.screenshot({ path: "scratch/arabic-dashboard-headings-390.png" });

  // ── the management desk: the six field labels ─────────────────────────────────────────────
  await page.goto(`${SITE}/admin/sales?tab=management`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(6000);
  const mgmtVisible = await page.evaluate(() => document.body.innerText.includes("عنوان الموقع"));
  if (!mgmtVisible) {
    await page.click('button:has-text("الإدارة")').catch(() => {});
    await page.waitForTimeout(4000);
  }
  const mgmt = await page.evaluate(GLOSS_SCAN);
  const mgmtText = await page.evaluate(() => document.body.innerText);
  const labels = ["عنوان الموقع", "وصف الموقع", "الكلمات المفتاحية", "الخط", "رابط الشعار", "رابط الأيقونة"];
  const shown = labels.filter((l) => mgmtText.includes(l));
  say("مكتب الإدارة", `عناوين ظاهرة ${shown.length} من ${labels.length} · عقد عربية ${mgmt.arabicNodes}`);
  check("العناوين الستة ظاهرة من غير قوس إنجليزي",
    shown.length === labels.length && !/\((SEO|Font|Logo|Favicon)/.test(mgmtText),
    `ناقص ${labels.filter((l) => !shown.includes(l)).join(",")}`);
  check("مفيش ولا حاشية إنجليزية في قوس على المكتب", mgmt.glossed.length === 0, JSON.stringify(mgmt.glossed).slice(0, 160));
  await page.screenshot({ path: "scratch/arabic-management-labels-390.png" });

  say("أخطاء الكونسول في الجلسة", errors.length);
  check("مفيش أخطاء كونسول", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 150));
} catch (e) {
  check("القياس اكتمل", false, String(e && e.message ? e.message : e));
} finally {
  if (browser) await browser.close();
}

const passed = checks.filter((c) => c.ok).length;
const summary = `النتيجة: ${passed} نجح من ${checks.length}`;
lines.push(summary);
writeFileSync("scratch/prove-screens-speak-arabic.out", lines.join("\n") + "\n");
console.log(summary);
process.exit(checks.length > 0 && passed === checks.length ? 0 : 1);
