import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys } from "@/lib/api-keys-service";
import { smartTestKey } from "@/lib/key-tester";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

async function insertKeys(supabase: any, rows: Record<string, unknown>[]) {
  const added: string[] = [], duplicates: string[] = [], errors: { key: string; error: string }[] = [];
  for (const row of rows) {
    const { data, error } = await supabase.from("api_keys").insert(row).select("key").single();
    if (!error && data) added.push(data.key);
    else if (error?.code === "23505" || /duplicate|unique/i.test(error?.message || "")) duplicates.push(String(row.key));
    else errors.push({ key: String(row.key), error: error?.message || "Insert failed" });
  }
  return { added, duplicates, errors };
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const body = await request.json();
    const provider = String(body.provider || "").trim().toLowerCase();
    const keys = [...new Set((Array.isArray(body.keys) ? body.keys : []).map((value: unknown) => String(value).trim()).filter(Boolean))];
    const notes = String(body.notes || "").trim() || null;
    if (!provider || !keys.length) return NextResponse.json({ success: false, error: "provider و keys[] مطلوبان" }, { status: 400 });
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });

    const results = body.testKeys === false ? keys.map((key) => ({ key, valid: true })) : await Promise.all(keys.map(async (key) => ({ key, ...(await smartTestKey(provider, key)) })));
    const passed = results.filter((result) => result.valid);
    const failed = results.filter((result) => !result.valid);
    const [passResult, failResult] = await Promise.all([
      insertKeys(supabase, passed.map((result) => ({ provider, key: result.key, notes, is_backup: Boolean(body.isBackup), is_active: true }))),
      insertKeys(supabase, failed.map((result) => ({ provider, key: result.key, notes, is_backup: false, is_active: false, error_count: 3, last_error: `[DEAD] ${result.error || "Key test failed"}` }))),
    ]);
    const summary = { total: keys.length, added: passResult.added.length, failed_test: failResult.added.length, duplicate: passResult.duplicates.length + failResult.duplicates.length, errored: passResult.errors.length + failResult.errors.length };
    const reload = await reloadKeys();
    if (!reload.success) return NextResponse.json({ success: false, persisted: true, summary, error: reload.error || "Keys persisted but reload failed" }, { status: 502 });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Bulk Import] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
