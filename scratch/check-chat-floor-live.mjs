import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Regression proof for the chat-floor atom on the published site: the cockpit chat must still
 * answer with a measured reply (not a floor sentence, not a machine sentence), and the row must
 * still carry its desk record.
 *   node scratch/check-chat-floor-live.mjs
 */
const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const b = await chromium.launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" })).newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 70)));

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

await p.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(13000);
const since = new Date(Date.now() - 1000).toISOString();
await p.evaluate((t) => window.__opsSend(t), "ايزاي الشغل الفترة دي");

let rows = [];
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(6000);
  const { data } = await sb
    .from("agent_messages")
    .select("id,created_at,context,content")
    .eq("sender_type", "agent")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3);
  rows = data ?? [];
  if (rows.length) break;
}

for (const r of rows) {
  const body = String(r.content).replace(/\s+/g, " ");
  const desks = (r.context?.desks ?? []).map((d) => `${d.desk}${d.ok ? "" : "!"}`).join(",") || "فاضي";
  console.log(`سطر ${r.id.slice(0, 8)} · desks=[${desks}]`);
  console.log(`  فيه كلام آلة (⚠️ أو exception)؟ ${/⚠️|Error|undefined|NaN/.test(body) ? "أيوه — ده الغلط" : "لأ"}`);
  console.log(`  فيه سطر الأرضية (مفيش مفتاح شغال)؟ ${body.includes("مفيش مفتاح شغال") ? "أيوه — وده غلط على المنشور، المفاتيح شغالة" : "لأ"}`);
  console.log(`  أول ١٢٠ حرف: «${body.slice(0, 120)}»`);
}
await p.waitForTimeout(3000);
await p.screenshot({ path: "scratch/chat-floor-regression.png" });
console.log(`\nأخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 2).join(" || ") : ""}`);
await b.close();
