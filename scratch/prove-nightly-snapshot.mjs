// Live proof: the store's own nightly copy, measured on the published site.
// Run: node scratch/prove-nightly-snapshot.mjs
import dotenv from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { gunzipSync } from "node:zlib";

dotenv.config({ path: ".env.local" });

const SITE = "https://azenith-living.vercel.app";
const BUCKET = "snapshots";
const TABLES = [
  "agent_messages", "agent_conversations", "agent_profiles", "agent_tasks",
  "consultant_sessions", "consultant_learnings", "consultant_pending_questions",
  "customer_memory", "ops_semantic_memory", "ops_sync_events", "site_settings",
];
const ORDER = { site_settings: "key" };
const day = new Date().toISOString().slice(0, 10);

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log((ok ? "نجح  : " : "فشل  : ") + name + (detail ? " — " + detail : ""));
}
function say(name, value) {
  console.log("قُرئ  : " + name + " = " + value);
}

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── 0 · the truth in the record, before anything is claimed ────────────────
const truth = {};
for (const t of TABLES) truth[t] = (await sql`select count(*)::int as c from ${sql(t)}`)[0].c;
const stampExistedBefore = (await sql`select count(*)::int as c from site_settings where key='nightly_snapshot_last'`)[0].c > 0;
say("سطور السجل الآن", TABLES.map((t) => `${t}=${truth[t]}`).join(" "));
say("الختم كان موجودًا قبل القياس", stampExistedBefore ? "نعم" : "لأ");

// ── 1 · the published site makes the copy, and waits for the new build ─────
let door = null;
for (let attempt = 1; attempt <= 40; attempt++) {
  const res = await fetch(`${SITE}/api/cron/ops-daily?only=snapshot`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401 || res.status === 503) {
    console.log("الباب رفض المفاتيح — حالة " + res.status + " · " + JSON.stringify(body?.error ?? ""));
    break;
  }
  // The marker has to be something ONLY the new build can say: the previous deployment already
  // answered with a table count, so «a count came back» proved nothing about which code ran.
  if (body?.results?.snapshotTables === TABLES.length) {
    door = body;
    say("محاولات انتظار النشر", attempt);
    break;
  }
  console.log(`النسخة المنشورة لسه بتردّ بـ ${body?.results?.snapshotTables ?? "لا عدد"} من ${TABLES.length} جدول (${attempt})`);
  await new Promise((r) => setTimeout(r, 30000));
}
check("الباب المنشور ردّ بالخطوة الجديدة", Boolean(door), door ? "" : "مفيش رد من الباب الجديد");
if (!door) {
  console.log("بدون باب حيّ القياس كامله موقوف");
  await sql.end();
  process.exit(1);
}

const r = door.results;
say("الباب قال: الجداول", r.snapshotTables);
say("الباب قال: السطور", r.snapshotRows);
say("الباب قال: بايت مضغوط", r.snapshotBytes);
say("الباب قال: ملاحظة", r.snapshotNote ?? "فاضية");
check("الباب قال مفيش رفض", !r.snapshotNote && door.success === true, String(r.snapshotNote ?? ""));

// ── 2 · the objects really exist in a private bucket, and hold the record ──
const bucketInfo = await sb.storage.getBucket(BUCKET);
check("الدرج موجود وخاص (لا يطلع للعامة)", bucketInfo.data && bucketInfo.data.public === false, "عام=" + bucketInfo.data?.public);

const dayFiles = await sb.storage.from(BUCKET).list(day + "/", { limit: 100 });
const names = (dayFiles.data ?? []).map((o) => o.name);
const publicTry = await fetch(`${sb.storage.from(BUCKET).getPublicUrl(`${day}/agent_messages.jsonl.gz`).data.publicUrl}`);
check("العالم بره ما بياخدش الملف ولو عرف عنوانه", publicTry.status !== 200, "حالة=" + publicTry.status);

const fileRows = {};
for (const t of TABLES) {
  const path = `${day}/${t}.jsonl.gz`;
  check(`ملف ${t} طالع في الدرج`, names.includes(`${t}.jsonl.gz`), names.join(","));
  const down = await sb.storage.from(BUCKET).download(path);
  if (down.error || !down.data) {
    check(`قراءة ملف ${t}`, false, down.error?.message ?? "مفيش بيانات");
    continue;
  }
  const bytes = Buffer.from(await down.data.arrayBuffer());
  const text = gunzipSync(bytes).toString("utf8");
  const lines = text.length ? text.split("\n").filter(Boolean) : [];
  fileRows[t] = lines.length;
  check(`عدد السطور في ملف ${t} = عدد السطور في السجل`, lines.length === truth[t], `ملف=${lines.length} سجل=${truth[t]}`);
  if (lines.length) {
    const first = JSON.parse(lines[0]);
    check(`سطر ${t} مقروء وباه حقله الأساسي`, Object.prototype.hasOwnProperty.call(first, "id") || Object.prototype.hasOwnProperty.call(first, "key"), Object.keys(first).slice(0, 4).join(","));
  }
}

// ── 3 · a row the browser cannot see is still in the file ──────────────────
const oldest = await sql`select id, content from agent_messages order by created_at asc limit 1`;
const downFirst = await sb.storage.from(BUCKET).download(`${day}/agent_messages.jsonl.gz`);
const textFirst = gunzipSync(Buffer.from(await downFirst.data.arrayBuffer())).toString("utf8");
check("أقدم سطر في محادثة المالك موجود داخل النسخة", textFirst.includes(oldest[0].id), oldest[0].id);

// ── 4 · the copy can actually be put back: restored into a throwaway table ─
const cols = await sql`
  select column_name, data_type, udt_name from information_schema.columns
  where table_schema='public' and table_name='agent_messages' order by ordinal_position`;
const recordDef = cols
  .map((c) => {
    const type =
      c.data_type === "USER-DEFINED" ? c.udt_name :
      c.data_type === "ARRAY" ? `${c.udt_name.replace(/^_/, "")}[]` :
      c.data_type === "timestamp with time zone" ? "timestamptz" :
      c.data_type === "character varying" ? "text" : c.data_type;
    return `"${c.column_name}" ${type}`;
  })
  .join(", ");
const parsed = textFirst.split("\n").filter(Boolean).map((line) => JSON.parse(line));
await sql.unsafe(`create temporary table restore_agent_messages as (select * from agent_messages limit 0)`);
await sql.unsafe(`insert into restore_agent_messages select * from json_to_recordset($1::json) as r(${recordDef})`, [parsed]);
const restored = (await sql`select count(*)::int as c from restore_agent_messages`)[0].c;
check("السطور المرجوعة رجعت بنفس العدد", restored === truth.agent_messages, `راجع=${restored} أصل=${truth.agent_messages}`);
const oneRestored = await sql`select content from restore_agent_messages where id = ${oldest[0].id}`;
check("السطر القديم رجع بكلمته بالحرف", String(oneRestored[0]?.content ?? "") === String(oldest[0].content), " طول=" + String(oneRestored[0]?.content?.length ?? 0));
await sql.unsafe("drop table restore_agent_messages");
const residue = (await sql`select count(*)::int as c from pg_tables where schemaname='public' and tablename like 'restore_%'`)[0].c;
check("الرجوع ما سابش طاولة في سجل المتجر", residue === 0, "فاضل=" + residue);

// ── 5 · the stamp in the settings row agrees with what was measured ────────
const stamp = await sql`select value from site_settings where key='nightly_snapshot_last'`;
const st = stamp[0]?.value;
say("ختم النسخة في الإعدادات", JSON.stringify(st));
check("الختم بيقول نفس يوم القياس", st?.day === day, st?.day);
const sumTruth = TABLES.reduce((n, t) => n + truth[t], 0);
check("الختم بيقول نفس عدد السطور اللي في السجل", st?.rows === sumTruth, "ختم=" + st?.rows + " سجل=" + sumTruth);
check("الختم بيقول مفيش رفض", Array.isArray(st?.failures) && st.failures.length === 0, JSON.stringify(st?.failures ?? null));

// ── 6 · the brakes held: the bank stayed out, and nothing was deleted ──────
check("بنك الصور ما دخلش في النسخة اليومية (الدرج ما يتاكلش)", !names.some((n) => n.includes("curated_images")), names.join(","));
check("كل جدول في النسخة محسوب، والعدّاد من القائمة نفسها", names.length === TABLES.length, `${names.length} مقابل ${TABLES.length}`);
check("حفظ مدير المبيعات بقى جوه النسخة", names.some((n) => n.includes("consultant_learnings")) && names.some((n) => n.includes("consultant_pending_questions")), names.join(","));
const after = {};
for (const t of TABLES) after[t] = (await sql`select count(*)::int as c from ${sql(t)}`)[0].c;
const expectedAfter = { ...truth };
if (!stampExistedBefore) expectedAfter.site_settings = truth.site_settings + 1;
check("القياس ما مسحش ولا بدّل ولا سطرًا — والزيادة الوحيدة هي ختم النسخة نفسه", TABLES.every((t) => after[t] === expectedAfter[t]), TABLES.filter((t) => after[t] !== expectedAfter[t]).map((t) => `${t}:${after[t]}≠${expectedAfter[t]}`).join(","));
say("السطور قبل وبعد", TABLES.map((t) => `${t}=${truth[t]}→${after[t]}`).join(" "));

await sql.end();
const failed = checks.filter((c) => !c.ok);
console.log(`\nراجعت ${checks.length} · نجح ${checks.length - failed.length} · فشل ${failed.length}`);
for (const f of failed) console.log(`فشل: ${f.name} — ${f.detail}`);
process.exit(failed.length ? 1 : 0);
