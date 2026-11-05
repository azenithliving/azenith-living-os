import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Live proof for the owner's two decisions, on the published site at 390px.
 *   node scratch/check-owner-decisions-live.mjs
 *
 * Four reads: the gate's mark, the admin header's mark, a real section opening in the preview,
 * and the negative control — an id the register does not hold must still say it is not found.
 */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: sections, error } = await sb.from("room_sections").select("id,name,display_order").order("display_order").limit(3);
if (error) throw new Error(error.message);
console.log(`السطور المتاحة للمعاينة: ${(sections ?? []).length} — أولهم «${sections?.[0]?.name}»`);

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 80)));

await p.goto(`${BASE}/gate/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(6000);
const gate = await p.evaluate(() => {
  const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";
  return { h1, latin: (h1.match(/[A-Za-z]/g) ?? []).length };
});
console.log(`\n١) بوابة الدخول: العنوان «${gate.h1}» · حروف لاتينية فيه: ${gate.latin}`);
await p.screenshot({ path: "scratch/decision-gate-live.png" });

await p.fill("input[type=email]", env.ADMIN_GATE_EMAIL);
await p.fill("input[type=password]", env.ADMIN_GATE_PASSWORD);
await p.click("button[type=submit]");
await p.waitForSelector('input[placeholder="000000"]', { timeout: 40000 });
const secret = env.ADMIN_GATE_2FA_SECRET.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
await p.fill('input[placeholder="000000"]', speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 }));
await p.click("button[type=submit]");
for (let i = 0; i < 20 && !p.url().includes("/admin"); i++) await p.waitForTimeout(2000);

await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(10000);
const admin = await p.evaluate(() => {
  const spans = [...document.querySelectorAll("span")].map((s) => s.textContent?.trim() ?? "");
  const mark = spans.find((t) => t.includes("أزينث")) ?? null;
  const latinMark = spans.find((t) => /AZENITH/i.test(t)) ?? null;
  return { mark, latinMark };
});
console.log(`\n٢) هيدر الإدارة: الماركة العربية «${admin.mark ?? "مفيش"}» · أي أثر لـ AZENITH: ${admin.latinMark ? `لقيانه («${admin.latinMark}») — ده الغلط` : "مفيش"}`);
await p.screenshot({ path: "scratch/decision-admin-live.png" });

const id = sections?.[0]?.id;
await p.goto(`${BASE}/preview/section/${id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(8000);
const preview = await p.evaluate(() => {
  const text = document.body.innerText.replace(/\s+/g, " ");
  return {
    head: text.includes("معاينة إدارية للقراءة فقط"),
    name: text.includes("المطابخ") || text.includes("غرف") || text.includes("صالون"),
    order: /ترتيبه في العرض/.test(text),
    notFound: text.includes("الصفحة غير موجودة"),
    snippet: text.slice(0, 190),
  };
});
console.log(`\n٣) معاينة قسم حقيقي (${id.slice(0, 8)}): رأس الصفحة ${preview.head ? "صح" : "لا"} · بيانات القسم ${preview.name ? "موجودة" : "مفيش"} · سطر الترتيب ${preview.order ? "صح" : "لا"} · ضلال ٤٠٤؟ ${preview.notFound ? "أيوه — ده الغلط" : "لأ"}`);
console.log(`   «${preview.snippet}»`);
await p.screenshot({ path: "scratch/decision-preview-live.png" });

await p.goto(`${BASE}/preview/section/11111111-1111-4111-8111-111111111111`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(6000);
const missing = await p.evaluate(() => document.body.innerText.includes("الصفحة غير موجودة"));
console.log(`\n٤) عكس الاختبار (معرّف مش في الدفتر): قال «غير موجود»؟ ${missing ? "أيوه" : "لأ — ده الغلط"}`);

console.log(`\nأخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 3).join(" || ") : ""}`);
await b.close();
