import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";

/**
 * Live proof for the row-provenance atom, on the published site at 390px.
 *   node scratch/check-row-provenance-live.mjs [base]
 *
 * Three reads, each one both a screen and a row:
 *   ١) a desk the router calls   → the row names it and the bubble names it in Arabic
 *   ٢) a desk only the leader's own shortcut calls (the full-site audit) → the case that used
 *      to store an empty object even though the work was real
 *   ٣) a turn where nothing ran  → the row states `desks: []` and the bubble stays clean
 * The verdict is read back from the stored row, never from what the browser showed.
 */
const BASE = process.argv.find((a) => a.startsWith("http")) ?? "https://azenith-living.vercel.app";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

/** The newest agent rows written after `since`, oldest first. */
async function rowsSince(since) {
  const { data, error } = await sb
    .from("agent_messages")
    .select("id,created_at,sender_type,sender_name,action_taken,context,content")
    .eq("sender_type", "agent")
    .gt("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function shape(row) {
  const c = row.context ?? {};
  const desks = Array.isArray(c.desks)
    ? c.desks.map((d) => `${d.desk}:${d.ok ? "تم" : "فشل"}`).join(", ") || "قائمة فاضية"
    : "مفيش سجل";
  return `via=${c.via ?? "—"} · desks=[${desks}] · action_taken=${JSON.stringify(row.action_taken)}`;
}

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "ar-EG" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load/i.test(m.text()) && errors.push(m.text().slice(0, 90)));

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

const legacyBadges = await p.evaluate(() => document.querySelectorAll("[data-desk-name]").length);
console.log(`شارة أسماء المكاتب على الصفوف القديمة في الشاشة: ${legacyBadges}`);

/** Send one turn, then wait for the row it writes and read both the row and the bubble. */
async function turn(label, text, budgetMs) {
  const since = new Date(Date.now() - 1000).toISOString();
  console.log(`\n—— ${label}: «${text}»`);
  const sent = await p.evaluate((t) => {
    const send = window.__opsSend;
    if (typeof send !== "function") return "no-send-hook";
    send(t);
    return "sent";
  }, text);
  if (sent !== "sent") {
    console.log("  مفيش وسيلة إرسال في الصفحة — الوقفة دي ما اتكملتش");
    return null;
  }
  const deadline = Date.now() + budgetMs;
  let rows = [];
  while (Date.now() < deadline) {
    await p.waitForTimeout(6000);
    rows = await rowsSince(since);
    if (rows.length) break;
  }
  if (!rows.length) {
    console.log(`  مفيش سطر اتكتب في ${Math.round(budgetMs / 1000)} ثانية — الباب ما ردّش`);
    return null;
  }
  for (const r of rows) console.log(`  سطر ${r.id.slice(0, 8)} · ${shape(r)} · «${String(r.content).replace(/\s+/g, " ").slice(0, 70)}»`);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(13000);
  const seen = await p.evaluate(() => {
    const els = [...document.querySelectorAll("[data-desk-name]")];
    const last = els.length ? els[els.length - 1] : null;
    const badge = last?.parentElement?.textContent?.replace(/\s+/g, " ").trim().slice(0, 140) ?? "";
    return { count: els.length, names: els.slice(-3).map((e) => e.textContent.trim()), badge };
  });
  console.log(`  على الشاشة: ${seen.count} شارة اسم مكتب — آخر تلاتة: ${seen.names.join(" | ") || "مفيش"}`);
  console.log(`  آخر شارة في سطر كامل: «${seen.badge}»`);
  return rows;
}

await turn("١) مكتب من الراوتر", "ايزاي الشغل الفترة دي", 150000);
await p.screenshot({ path: "scratch/row-provenance-tool.png", fullPage: false });

await turn("٢) مكتب الفحص الشامل", "افحص الموقع كله", 200000);
await p.screenshot({ path: "scratch/row-provenance-audit.png", fullPage: false });

await turn("٣) مفيش مكتب", "صباح الخير يا كبير", 150000);
await p.screenshot({ path: "scratch/row-provenance-none.png", fullPage: false });

const all = await rowsSince(new Date(Date.now() - 45 * 60 * 1000).toISOString());
console.log(`\nسطور الموظف اللي اتكتبت في الشات من الآلة دي: ${all.length}`);
for (const r of all) console.log(`  ${r.created_at} · ${r.id} · ${shape(r)}`);
console.log(`أخطاء الكنسول: ${errors.length}${errors.length ? " — " + errors.slice(0, 3).join(" || ") : ""}`);

await b.close();
