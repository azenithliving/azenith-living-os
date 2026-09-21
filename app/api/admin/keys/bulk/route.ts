import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys, smartTestKey } from "@/lib/api-keys-service";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

async function insertKeys(supabase: any, rows: Record<string, unknown>[]) {
  const added: string[] = [];
  const duplicates: string[] = [];
  const errors: { key: string; error: string }[] = [];

  for (const row of rows) {
    const { data, error } = await supabase.from("api_keys").insert(row).select("key").single();
    if (!error && data) {
      added.push(data.key);
      continue;
    }
    const message = error?.message || "Insert failed";
    if (error?.code === "23505" || /duplicate|unique/i.test(message)) duplicates.push(String(row.key));
    else errors.push({ key: String(row.key), error: message });
  }
  return { added, duplicates, errors };
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const body = await request.json();
    const provider = String(body.provider || "").trim().toLowerCase();
    const keys = Array.isArray(body.keys) ? body.keys : [];
    const notes = String(body.notes || "").trim() || null;
    const isBackup = Boolean(body.isBackup);
    const testKeys = body.testKeys !== false;

    if (!provider || keys.length === 0) return NextResponse.json({ success: false, error: "provider و keys[] مطلوبان" }, { status: 400 });
    const cleaned = [...new Set(keys.map((key: unknown) => String(key).trim()).filter(Boolean))];
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });

    const results = testKeys
      ? await Promise.all(cleaned.map(async (key) => ({ key, ...(await smartTestKey(provider, key)) })))
      : cleaned.map((key) => ({ key, valid: true }));
    const passed = results.filter((result) => result.valid);
    const failed = results.filter((result) => !result.valid);

    const [passResult, failResult] = await Promise.all([
      insertKeys(supabase, passed.map((result) => ({ provider, key: result.key, notes, is_backup: isBackup, is_active: true }))),
      insertKeys(supabase, failed.map((result) => ({ provider, key: result.key, notes, is_backup: false, is_active: false, error_count: 3, last_error: `[DEAD] ${result.error || "Key test failed"}` }))),
    ]);

    const reload = await reloadKeys();
    const summary = {
      total: cleaned.length,
      added: passResult.added.length,
      failed_test: failResult.added.length,
      duplicate: passResult.duplicates.length + failResult.duplicates.length,
      errored: passResult.errors.length + failResult.errors.length,
    };

    if (!reload.success) {
      return NextResponse.json({ success: false, persisted: true, error: reload.error || "Keys persisted but reload failed", summary }, { status: 502 });
    }
    return NextResponse.json({ success: true, summary, message: `تمت المعالجة: نشط ${summary.added}، ميت ${summary.failed_test}، مكرر ${summary.duplicate}، أخطاء ${summary.errored}` });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Bulk Import] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
