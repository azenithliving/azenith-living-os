/**
 * prove-backup-one-owner.mjs — the chat's backup tools and the nightly round, measured on the live site.
 *
 * The old `backup_create` tool was a phantom (four of its six tables do not exist, it wrote to a table
 * that does not exist, never copied the chat table that actually lost rows, and asked for a PUBLIC blob
 * URL). This opens the published doors with his own session and measures that the tool now produces the
 * same artifact the round does — and that the restore door refuses to write instead of lying.
 */
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";

const BASE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const TABLES = [
  "agent_messages", "agent_conversations", "agent_profiles", "agent_tasks",
  "consultant_sessions", "customer_memory", "ops_semantic_memory", "ops_sync_events", "site_settings",
];
const day = new Date().toISOString().slice(0, 10);

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "نجح" : "فشل"} — ${name}${detail ? ` · ${detail}` : ""}`);
};
const say = (label, value) => console.log(`${label}: ${value}`);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const before = {};
for (const t of TABLES) before[t] = (await sql`select count(*)::int c from ${sql(t)}`)[0].c;
const stampBefore = (await sql`select count(*)::int c from site_settings where key='nightly_snapshot_last'`)[0].c;
const sumBefore = TABLES.reduce((n, t) => n + before[t], 0);
say("السطور قبل", TABLES.map((t) => `${t}=${before[t]}`).join(" ") + " · المجموع=" + sumBefore);

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
check("دخل اللوحة", page.url().includes("/admin"), page.url().replace(BASE, ""));

async function callTool(toolName, params = {}) {
  const res = await page.request.post(`${BASE}/api/admin/agent/tools/execute`, {
    data: { toolName, params },
    headers: { "content-type": "application/json" },
    timeout: 180000,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status(), body };
}

// The published build must be the one carrying the fix; retry until it answers like it.
const NAME = "live-proof-" + day;
let created = null;
for (let attempt = 1; attempt <= 12; attempt++) {
  created = await callTool("backup_create", { name: NAME, description: "قياس حيّ من المحاجة" });
  const body = created.body ?? {};
  if (body.data?.bucket === "snapshots" || /وقفت/.test(String(body.message ?? ""))) break;
  console.log("النسخة المنشورة لسه القديمة (محاولة " + attempt + ") — " + String(body.message ?? JSON.stringify(body)).slice(0, 90));
  await new Promise((r) => setTimeout(r, 45000));
}
say("حالة الباب", created.status);
const res = created.body ?? {};
say("رد الأداة", JSON.stringify(res?.message ?? res?.error ?? res).slice(0, 220));
check("الأداة ردّت بنسخة حقيقية", res?.success === true, JSON.stringify(res).slice(0, 120));
check("الأداة بتتكلم على الدرج الخاص، مش جدول ميت", res?.data?.bucket === "snapshots", res?.data?.bucket);
check("العدد اللي قالته الأداة = عدد السطور في السجل", res?.data?.rows === sumBefore, `الأداة=${res?.data?.rows} السجل=${sumBefore}`);
check("الرسالة بالعربي وبأرقام عربية", /النسخة الاحتياطية اتعملت/.test(String(res?.message ?? "")) && /[٠-٩]/.test(String(res?.message ?? "")), String(res?.message ?? "").slice(0, 70));
check("الأداة ما بتدّعيش عنوان تحميل عام", !/https?:\/\/[^"]*blob/i.test(JSON.stringify(res ?? {})), "مفيش عنوان عام");

const listed = await callTool("backup_list", {});
const listRes = listed.body ?? {};
say("قائمة النسخ", JSON.stringify(listRes?.data ?? listRes).slice(0, 200));
check("العداد بيشوف أيام النسخ فعلاً", Array.isArray(listRes?.data?.days) && listRes.data.days.length >= 1, "أيام=" + (listRes?.data?.days ?? []).length);
check("أحدث يوم هو النهاردة", listRes?.data?.latest === day, "latest=" + listRes?.data?.latest);
check("تسع ملفات في أحدث يوم", (listRes?.data?.files ?? []).length === 9, "ملفات=" + (listRes?.data?.files ?? []).length);

let restored = await callTool("backup_restore", { backupId: "latest", confirmRestore: false });
let restoreRes = restored.body ?? {};
for (let attempt = 1; attempt <= 16 && !restoreRes?.approvalId; attempt++) {
  console.log("الباب لسه بيقول: " + String(restoreRes.message ?? "").slice(0, 60) + " (محاولة " + attempt + ")");
  await new Promise((r) => setTimeout(r, 45000));
  restored = await callTool("backup_restore", { backupId: "latest", confirmRestore: false });
  restoreRes = restored.body ?? {};
}
say("باب الرجوع", JSON.stringify(restoreRes?.message ?? restoreRes).slice(0, 200));
check("باب الرجوع ما كتبش في السجل — بيطلب كلمتك أو بيرفض", restoreRes?.requiresApproval === true || restoreRes?.success === false, "success=" + restoreRes?.success + " · مطلوب موافقة=" + restoreRes?.requiresApproval);
const honestRestore = /الدرج الخاص/.test(String(restoreRes?.message ?? "")) || /موافقة|approval|طلب/i.test(JSON.stringify(restored.body ?? {}));
check("وبدل ما يدّعي إن مفيش نسخة، بيسمّي النسخ الموجودة أو بيطلب كلمتك", honestRestore, String(restoreRes?.message ?? "").slice(0, 60));

const approvalId = restoreRes?.approvalId ?? null;
if (approvalId) {
  const found = await sql`select action_type, status from approval_requests where id = ${approvalId}`;
  check("طلب الموافقة بقى بيوصل فعلاً للسجل", found.length === 1, "موجود=" + found.length + " · نوع=" + (found[0]?.action_type ?? "-"));
  const meta = await sql`select metadata->>'toolName' as tool from approval_requests where id = ${approvalId}`;
  check("الطلب بيقول اسم الأداة في بياناته", String(meta[0]?.tool ?? "") === "backup_restore", "أداة=" + (meta[0]?.tool ?? "-"));
  await sql`delete from approval_requests where id = ${approvalId}`;
  const residue = await sql`select count(*)::int as c from approval_requests where id = ${approvalId}`;
  check("أثر المحاجة من طلبات الموافقة اتمسح (سطر المحاجة بس)", residue[0].c === 0, "فاضل=" + residue[0].c);
} else {
  check("طلب الموافقة بقى بيوصل فعلاً للسجل", false, "الباب ما رجّعش معرّف: " + JSON.stringify(restoreRes).slice(0, 100));
}

const after = {};
for (const t of TABLES) after[t] = (await sql`select count(*)::int c from ${sql(t)}`)[0].c;
const stampAfter = (await sql`select count(*)::int c from site_settings where key='nightly_snapshot_last'`)[0].c;
const allowed = TABLES.filter((t) => !(after[t] === before[t] || (t === "site_settings" && after[t] === before[t] + (stampBefore ? 0 : 1))));
check("القياس ما غيّرش سطرًا في سجله", allowed.length === 0, allowed.map((t) => `${t}:${before[t]}→${after[t]}`).join(","));
check("سطر الختم اتكتب مرة واحدة بس", stampAfter === (stampBefore ? 1 : 1), "قبل=" + stampBefore + " بعد=" + stampAfter);

const obj = await sb.storage.from("snapshots").download(`${day}/agent_messages.jsonl.gz`);
const lines = gunzipSync(Buffer.from(await obj.data.arrayBuffer())).toString("utf8").split("\n").filter(Boolean);
check("الملف في الدرج فيه محادثة المالك كاملة", lines.length === after.agent_messages, `ملف=${lines.length} سجل=${after.agent_messages}`);

await page.goto(`${BASE}/admin/v2/agents/ops`, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(9000);
const composer = await page.evaluate(() => {
  const holder = document.querySelector("[data-chat-composer]");
  const field = holder?.querySelector("input, textarea") ?? holder;
  if (!field) return null;
  const b = field.getBoundingClientRect();
  return { x: Math.round(b.x), right: Math.round(b.right), w: Math.round(b.width), inView: b.width > 0 && b.x >= 0 && b.right <= window.innerWidth + 1 };
});
say("مربّع الكتابة", JSON.stringify(composer));
check("الكابينة سليمة عند عرض ٣٩٠", Boolean(composer?.inView), JSON.stringify(composer));
check("صفر رسالة خطأ في المتصفح", errors.length === 0, errors.slice(0, 2).map((e) => e.slice(0, 90)).join(" | "));
await page.screenshot({ path: "scratch/backup-one-owner-390.png" });

await browser.close();
await sql.end();
const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log("فشل: " + f.name);
process.exit(failed.length ? 1 : 0);
