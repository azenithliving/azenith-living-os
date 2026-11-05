import { readFileSync, writeFileSync } from "node:fs";

/**
 * One owner of the store's copy. The chat tool `backup_create` and the `backup_list` tool are
 * re-pointed at `lib/ops/nightly-snapshot.ts`, the module that was measured live today. What they
 * used before is measured dead: `backup_snapshots` does not exist, and neither do four of the six
 * tables the old handler named (companies=1 row, users=33, the rest absent), and its upload asked
 * for a PUBLIC Vercel Blob URL over the owner's own record.
 */

const crlf = (s) => (s.match(/\r/g) ?? []).length;

function spliceFunction(src, signature, replacement) {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error("لم أجد التوقيع: " + signature);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const end = src.indexOf("\n", i);
  return src.slice(0, start) + replacement.trimEnd() + src.slice(end);
}

const file = "lib/agent-tools/tool-handlers.ts";
let src = readFileSync(file, "utf8");

const createNew = `export async function executeBackupCreate(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // The chat's «اعمل نسخة احتياطية» and the morning round now call the same module, so the store has
  // one copy with one measured shape instead of two owners disagreeing about what was saved.
  const { runNightlySnapshot, SNAPSHOT_BUCKET } = await import("@/lib/ops/nightly-snapshot");
  const { arNum } = await import("@/lib/ops/metricLabels");
  try {
    const snap = await runNightlySnapshot();
    const ok = snap.failures.length === 0;
    return {
      success: ok,
      message: ok
        ? \`النسخة الاحتياطية اتعملت: \${arNum(snap.tables)} جداول و\${arNum(snap.rows)} سطراً، \${arNum(Math.round(snap.bytes / 1024))} كيلوبايت في الدرج الخاص — وكل ملف اتمّت قراءته من الدرج تاني وعدّاده طابق السجل.\`
        : \`النسخة الاحتياطية وقفت: \${snap.failures[0]}\`,
      data: {
        day: snap.day,
        bucket: SNAPSHOT_BUCKET,
        tables: snap.tables,
        rows: snap.rows,
        bytes: snap.bytes,
        failures: snap.failures,
        objects: snap.writes.map((w) => w.path),
      },
      executionId: context.executionId,
    };
  } catch (error) {
    const why = error instanceof Error ? error.message : "خطأ غير معروف";
    return {
      success: false,
      message: \`النسخة الاحتياطية وقفت: \${why}\`,
      error: why,
      executionId: context.executionId,
    };
  }
}`;

const listNew = `export async function executeBackupList(
  _params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const { SNAPSHOT_BUCKET } = await import("@/lib/ops/nightly-snapshot");
  const { arNum } = await import("@/lib/ops/metricLabels");
  const supabase = getServiceSupabase();
  try {
    if (!supabase) throw new Error("مفتاح الخدمة مش ضابط");
    const days = await supabase.storage.from(SNAPSHOT_BUCKET).list("", { limit: 60 });
    if (days.error) throw days.error;
    const named = (days.data ?? []).map((d) => d.name).filter((n) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(n));
    const sorted = named.slice().sort().reverse();
    if (!sorted.length) {
      return {
        success: true,
        message: "مفيش نسخة احتياطية في الدرج لحد دلوقتي — الجولة اليومية لسه ما عملتش واحدة.",
        data: { bucket: SNAPSHOT_BUCKET, days: [] },
        executionId: context.executionId,
      };
    }
    const files = await supabase.storage.from(SNAPSHOT_BUCKET).list(sorted[0] + "/", { limit: 100 });
    const list = (files.data ?? []).map((f) => ({
      path: \`\${sorted[0]}/\${f.name}\`,
      bytes: (f.metadata as { size?: number } | null)?.size ?? null,
      writtenAt: f.updated_at ?? null,
    }));
    return {
      success: true,
      message: \`عندك \${arNum(sorted.length)} يوم فيه نسخة، أحدثها \${sorted[0]} وفيه \${arNum(list.length)} ملف في الدرج الخاص.\`,
      data: { bucket: SNAPSHOT_BUCKET, days: sorted.slice(0, 14), latest: sorted[0], files: list },
      executionId: context.executionId,
    };
  } catch (error) {
    const why = error instanceof Error ? error.message : "خطأ غير معروف";
    return {
      success: false,
      message: \`قراءة النسخ الاحتياطية فشلت: \${why}\`,
      executionId: context.executionId,
    };
  }
}`;

const before = src;
src = spliceFunction(src, "export async function executeBackupCreate(", createNew);
src = spliceFunction(src, "export async function executeBackupList(", listNew);
if (src.includes("backup_snapshots") && /from\("backup_snapshots"\)/.test(src)) {
  const left = (src.match(/from\("backup_snapshots"\)/g) ?? []).length;
  console.log("تنبيه: لسه فيه " + left + " استخدام لجدول النسخ القديم في نفس الملف");
}
if (crlf(before) !== crlf(src)) throw new Error("خط نهاية اتغيّر — مرفوض");
writeFileSync(file, src);
console.log("اتصلح: create + list · طول الملف " + before.length + " → " + src.length);
