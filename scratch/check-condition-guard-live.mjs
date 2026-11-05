import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Live proof for the condition guard, on the published site at 390px.
 *   node scratch/check-condition-guard-live.mjs
 *
 * Two turns, and the second one is the negative control:
 *   أ) a short question that tempts the leader to declare the shop fine, with no desk running
 *      → the stored sentence must carry «اتشال من الرد كلام عن …» and must NOT keep the claim
 *   ب) the shop's own live reading → the numbers must survive untouched, because a measurement
 *      struck as unmeasured is the opposite lie and the one this project keeps almost making
 * The verdict is read from the stored row, never from the browser.
 */
const BASE = "https://azenith-living.vercel.app";
const NOTE = "اتشال من الرد كلام عن";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function rowsSince(since) {
  const { data, error } = await sb
    .from("agent_messages")
    .select("id,created_at,context,content")
    .eq("sender_type", "agent")
    .gt("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const shape = (r) => {
  const desks = Array.isArray(r.context?.desks)
    ? r.context.desks.map((d) => `${d.desk}${d.ok ? "" : "!"}`).join(",") || "فاضي"
    : "مفيش سجل";
  return `desks=[${desks}]`;
};

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text().replace(/\s+/g, " ").slice(0, 70)));

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
console.log(`بوابة الإدارة: ${p.url().includes("/admin") ? "اتفتح" : "ما اتفتحش"}`);

await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(14000);

async function turn(text, budgetMs) {
  const since = new Date(Date.now() - 1000).toISOString();
  const sent = await p.evaluate((t) => {
    if (typeof window.__opsSend !== "function") return "no-send-hook";
    window.__opsSend(t);
    return "sent";
  }, text);
  if (sent !== "sent") throw new Error("مفيش وسيلة إرسال في الصفحة");
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    await p.waitForTimeout(6000);
    const rows = await rowsSince(since);
    if (rows.length) return rows;
  }
  return [];
}

const a = await turn("قولي حالة الدار النهاردة باختصار", 180000);
console.log(`\nأ) «قولي حالة الدار النهاردة باختصار»`);
for (const r of a) {
  const body = String(r.content).replace(/\s+/g, " ");
  console.log(`  ${r.id.slice(0, 8)} · ${shape(r)} · فيه سطر الاتشال؟ ${body.includes(NOTE) ? "أيوه" : "لأ"}`);
  console.log(`  الرد: «${body.slice(0, 230)}»`);
}
await p.waitForTimeout(4000);
await p.screenshot({ path: "scratch/condition-guard-struck.png" });

const c = await turn("ايزاي الشغل الفترة دي", 180000);
console.log(`\nب) «ايزاي الشغل الفترة دي» — عكس الاختبار`);
for (const r of c) {
  const body = String(r.content).replace(/\s+/g, " ");
  console.log(`  ${r.id.slice(0, 8)} · ${shape(r)} · كلام اتشال؟ ${body.includes(NOTE) ? "أيوه — وده الغلط" : "لأ"}`);
  console.log(`  أول سطر: «${body.slice(0, 160)}»`);
}
await p.waitForTimeout(4000);
await p.screenshot({ path: "scratch/condition-guard-kept.png" });

console.log(`\nأخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 3).join(" || ") : ""}`);
await b.close();
