/**
 * prove-gate-password-only.mjs — the owner's word, measured on his own door.
 *
 * He asked for the verification code to stop standing between him and his dashboard. This opens the
 * published gate at 390px with email and password alone and proves four things: the code step never
 * appears, the dashboard actually renders, a wrong password is still refused, and the login is written
 * in the session ledger as what it really was — no second factor, by his order.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";

const BASE = "https://azenith-living.vercel.app";
const RUN_STARTED = new Date().toISOString();

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const setting = await sql`select value::text as v from site_settings where key = 'admin_gate_2fa_required'`;
say("أمره في سجل الإعدادات", setting.length ? setting[0].v : "مفيش سطر");

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
const landed = page.url();
say("وصل لحد فين", landed.replace(BASE, ""));
check("دخل من غير ما يطلب كود", landed.includes("/admin"), landed.slice(-30));

const askedForCode = await page.locator('input[placeholder="000000"]').count();
check("خطوة كود التحقق ما ظهرتش", askedForCode === 0, `عدد خانات الكود=${askedForCode}`);

await page.waitForTimeout(6000);
const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 200));
say("أول اللي في الشاشة", body.slice(0, 120));
check("اللوحة فعلاً اتفتحت", body.length > 40 && !/تسجيل الدخول|بوابة الدخول/.test(body), body.slice(0, 50));
await page.screenshot({ path: "scratch/gate-password-only-390.png" });

// The refusal still refuses: a password-only gate must not become an open door.
const bad = await ctx.request.post(`${BASE}/api/admin/gate/validate`, {
  data: { email: env.ADMIN_GATE_EMAIL, password: `${env.ADMIN_GATE_PASSWORD}-wrong` },
});
check("كلمة سر غلط لسه مرفوضة", bad.status() === 401, `الباب ردّ ${bad.status()}`);

await new Promise((r) => setTimeout(r, 3000));
const mine = await sql`
  select id, is_2fa_verified, ip_address from sovereign_sessions
  where created_at >= ${RUN_STARTED} order by created_at desc limit 3`;
say("جلسات اتسجلت في نافذة القياس", mine.length);
check("الدخول اتسجّل بأنه بلا تحقق", mine.some((s) => s.is_2fa_verified === false), mine.map((s) => String(s.is_2fa_verified)).join(","));

let cleaned = 0;
for (const s of mine) {
  const gone = await sql`delete from sovereign_sessions where id = ${s.id} returning id`;
  cleaned += gone.length;
}
say("جلسات المحاجة اللي امسحتها", cleaned);
const left = (await sql`select count(*)::int as c from sovereign_sessions where created_at >= ${RUN_STARTED}`)[0].c;
check("مفيش أثر سايّب", left === 0, `فاضل=${left}`);

const consoleErrors = errors.filter((e) => !/favicon|Download the React|401|net::ERR_/i.test(e));
check("صفر رسالة خطأ في المتصفح", consoleErrors.length === 0, consoleErrors.slice(0, 2).map((e) => e.slice(0, 80)).join(" | "));

await browser.close();
await sql.end();

const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log(`فشل: ${f.name}`);
process.exit(failed.length ? 1 : 0);
