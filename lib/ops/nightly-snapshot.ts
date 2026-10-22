import "server-only";
/**
 * The nightly snapshot — the store's own copy of the rows that cannot be re-made.
 *
 * It exists because of a measured loss: on 2026-10-19 an instrument of mine deleted 306 rows of the
 * owner's real chat history (1,741 → 1,435) and there was nowhere to read them back from. The plan
 * this store runs on has no automatic restore point and no management token to buy one, so the only
 * backup that exists is the one the app writes itself, inside the project the owner already owns.
 *
 * What it copies: the eleven tables that hold the owner's record — his chat with the swarm, the
 * conversations behind it, the employee profiles and their task log, the customer conversations the
 * advisor keeps, the rules he was taught and the questions still waiting for him (measured 2026-10-23:
 * 51 and 38 rows — the manager's memory was outside his own backup until that day), both memory
 * tables, the sync ledger, and the settings rows that carry his orders.
 * What it deliberately does not: the picture bank (13,631,488 bytes on disk against 5,505,024 for all
 * eleven copied tables, measured the same day — and it is the one thing the harvest pipeline can
 * re-make), and any table holding a credential.
 *
 * Two brakes decide the shape. Nothing here deletes or rotates anything: an old snapshot is a copy of
 * the owner's data and retiring it is his word, not a schedule's. And every object is read back from
 * the bucket and counted before the step claims success — the file's row count must equal the
 * record's, or the round reports the mismatch instead of reporting a backup.
 */
import { gzipSync, gunzipSync } from "node:zlib";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendSecurityAlert } from "@/lib/telegram-notify";

export const SNAPSHOT_BUCKET = "snapshots";

/** Supabase hands back at most 1,000 rows a request; 500 keeps one page well inside it. */
const PAGE_ROWS = 500;

export interface SnapshotTarget {
  table: string;
  /** A stable ordering key, so paging cannot skip a row or count one twice. */
  order: string;
}

/** The record the owner cannot rebuild. `site_settings` is keyed by its own `key` column. */
export const SNAPSHOT_TARGETS: SnapshotTarget[] = [
  { table: "agent_messages", order: "id" },
  { table: "agent_conversations", order: "id" },
  { table: "agent_profiles", order: "id" },
  { table: "agent_tasks", order: "id" },
  { table: "consultant_sessions", order: "id" },
  { table: "consultant_learnings", order: "id" },
  { table: "consultant_pending_questions", order: "id" },
  { table: "customer_memory", order: "id" },
  { table: "ops_semantic_memory", order: "id" },
  { table: "ops_sync_events", order: "id" },
  { table: "site_settings", order: "key" },
];

/** The settings row the snapshot stamps itself with, so freshness is one read away. */
export const SNAPSHOT_STAMP_KEY = "nightly_snapshot_last";

export interface SnapshotWrite {
  table: string;
  rows: number;
  storedRows: number;
  bytes: number;
  storedBytes: number;
  path: string;
  error?: string;
}

export interface SnapshotOutcome {
  day: string;
  writes: SnapshotWrite[];
  tables: number;
  rows: number;
  bytes: number;
  failures: string[];
  note: string | null;
}

export function snapshotObjectPath(day: string, table: string): string {
  return `${day}/${table}.jsonl.gz`;
}

export function snapshotDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

async function ensureBucket(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const existing = await supabase.storage.getBucket(SNAPSHOT_BUCKET);
  if (existing.data) return null;
  const created = await supabase.storage.createBucket(SNAPSHOT_BUCKET, { public: false });
  if (created.error && !/already exists/i.test(created.error.message)) return created.error.message;
  return null;
}

async function readTableRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  target: SnapshotTarget
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_ROWS) {
    const page = await supabase
      .from(target.table)
      .select("*")
      .order(target.order, { ascending: true })
      .range(from, from + PAGE_ROWS - 1);
    if (page.error) return { rows, error: `قراءة ${target.table}: ${page.error.message}` };
    const got = (page.data ?? []) as Record<string, unknown>[];
    rows.push(...got);
    if (got.length < PAGE_ROWS) return { rows, error: null };
  }
}

async function snapshotTable(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  day: string,
  target: SnapshotTarget
): Promise<SnapshotWrite> {
  const path = snapshotObjectPath(day, target.table);
  const read = await readTableRows(supabase, target);
  if (read.error) {
    return { table: target.table, rows: read.rows.length, storedRows: 0, bytes: 0, storedBytes: 0, path, error: read.error };
  }

  const jsonl = read.rows.map((row) => JSON.stringify(row)).join("\n");
  const plain = Buffer.from(jsonl, "utf8");
  const packed = gzipSync(plain);

  const up = await supabase.storage.from(SNAPSHOT_BUCKET).upload(path, packed, {
    contentType: "application/gzip",
    upsert: true,
  });
  if (up.error) {
    return {
      table: target.table,
      rows: read.rows.length,
      storedRows: 0,
      bytes: plain.length,
      storedBytes: 0,
      path,
      error: `رفع ${target.table}: ${up.error.message}`,
    };
  }

  const down = await supabase.storage.from(SNAPSHOT_BUCKET).download(path);
  if (down.error || !down.data) {
    return {
      table: target.table,
      rows: read.rows.length,
      storedRows: 0,
      bytes: plain.length,
      storedBytes: 0,
      path,
      error: `رجوع ${target.table}: ${down.error?.message ?? "الملف ما جاش"}`,
    };
  }

  let back: string;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await down.data.arrayBuffer());
    back = gunzipSync(buffer).toString("utf8");
  } catch (e: any) {
    return {
      table: target.table,
      rows: read.rows.length,
      storedRows: 0,
      bytes: plain.length,
      storedBytes: 0,
      path,
      error: `فكّ ${target.table}: الملف المرجوع مش سليم (${e.message})`,
    };
  }
  const storedRows = back.length ? back.split("\n").filter((line) => line.length > 0).length : 0;
  const write: SnapshotWrite = {
    table: target.table,
    rows: read.rows.length,
    storedRows,
    bytes: plain.length,
    storedBytes: buffer.length,
    path,
  };
  if (storedRows !== read.rows.length) {
    write.error = `رجوع ${target.table}: الملف فيه ${storedRows} سطر والسجل فيه ${read.rows.length}`;
  }
  console.log(`[Snapshot] ${target.table} — كتبنا ${read.rows.length} · المحفوظ ${storedRows} · مضغوط ${buffer.length} بايت`);
  return write;
}

export async function runNightlySnapshot(): Promise<SnapshotOutcome> {
  const day = snapshotDay();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const why = "مفتاح الخدمة مش ضابط — النسخة ما اتعملتش";
    return { day, writes: [], tables: 0, rows: 0, bytes: 0, failures: [why], note: why };
  }

  const bucketError = await ensureBucket(supabase);
  if (bucketError) {
    return { day, writes: [], tables: 0, rows: 0, bytes: 0, failures: [`الدرج: ${bucketError}`], note: "الدرج ما اتفتحش" };
  }

  const writes: SnapshotWrite[] = [];
  for (const target of SNAPSHOT_TARGETS) {
    writes.push(await snapshotTable(supabase, day, target));
  }

  const failures = writes.filter((w) => w.error).map((w) => w.error as string);
  const rows = writes.reduce((sum, w) => sum + w.storedRows, 0);
  const bytes = writes.reduce((sum, w) => sum + w.storedBytes, 0);
  const stamp = { day, tables: writes.length, rows, bytes, failures };

  // The stamp is the owner's own record of the copy, so freshness is one settings read away.
  const stamped = await supabase
    .from("site_settings")
    .upsert({ key: SNAPSHOT_STAMP_KEY, value: stamp, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (stamped.error) {
    failures.push(`ختم النسخة في الإعدادات: ${stamped.error.message}`);
  } else {
    const readBack = await supabase.from("site_settings").select("value").eq("key", SNAPSHOT_STAMP_KEY).maybeSingle();
    const stored = readBack.data?.value as { rows?: number } | undefined;
    if (!stored || stored.rows !== rows) {
      failures.push(`ختم النسخة ما اتقراش صح: المحفوظ ${stored?.rows ?? "لا شيء"} مقابل ${rows}`);
    }
  }

  const note = failures.length ? failures[0] : null;
  console.log(`[Snapshot] ${day} — الجداول ${writes.length} · السطور ${rows} · مضغوط ${bytes} بايت · مرفوض ${failures.length}`);
  if (failures.length) {
    const sent = await sendSecurityAlert(`النسخة الاحتياطية الليلية وقفت: ${failures[0]}`);
    if (!sent) failures.push("تنبيه النسخة ما وصلش على تليجرام");
  }

  return { day, writes, tables: writes.length, rows, bytes, failures, note };
}

/**
 * Has the copy been made today? Read from the stamp, never inferred from a quiet log — an unread
 * line is exactly how a dead backup hides.
 */
export function snapshotIsFresh(stamp: unknown, at: Date = new Date()): boolean {
  const day = (stamp as { day?: unknown } | null)?.day;
  return typeof day === "string" && day === snapshotDay(at);
}
