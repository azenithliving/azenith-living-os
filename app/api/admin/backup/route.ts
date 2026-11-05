/**
 * /api/admin/backup — the copy's own state, read not inferred.
 *
 * GET answers «آخر نسخة إمتى وبتاخد كام جدول» from the stamp row the copy writes for itself, plus the
 * measured coverage file. A missing stamp or a missing measurement is named, never returned as zero.
 *
 * POST copies a named part of the set now, and answers with the read-back count per table — the copy
 * is only real once the object came back and its rows matched the record's.
 */

import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";

import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SNAPSHOT_STAMP_KEY, runNightlySnapshot, runSnapshotForTables, snapshotIsFresh } from "@/lib/ops/nightly-snapshot";
import { SNAPSHOT_TARGETS } from "@/lib/ops/snapshot-scope";

export const dynamic = "force-dynamic";

const COVERAGE_PATH = "docs/ledger/backup-coverage.json";

function refusal(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json({ success: false, error: "لازم تكون داخل بلوحة التحكم قبل ما النسخة تتقرا" }, { status: error.status })
    : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return refusal(error) ?? NextResponse.json({ success: false, error: "الباب ما ردّش" }, { status: 500 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "مفتاح الخدمة مش ضابط — حالة النسخة ما تتقارش" }, { status: 503 });
  }
  const read = await supabase.from("site_settings").select("value").eq("key", SNAPSHOT_STAMP_KEY).maybeSingle();
  if (read.error) {
    return NextResponse.json(
      { success: false, error: `ختم النسخة ما اتقراش (${read.error.message})` },
      { status: 502 },
    );
  }

  const coverage = existsSync(COVERAGE_PATH) ? JSON.parse(readFileSync(COVERAGE_PATH, "utf8")) : null;
  return NextResponse.json({
    success: true,
    stamp: read.data?.value ?? null,
    fresh: snapshotIsFresh(read.data?.value),
    targets: SNAPSHOT_TARGETS.length,
    coverage: coverage
      ? { measuredAt: coverage.measuredAt, line: coverage.line, unexplained: coverage.unexplained?.length ?? null }
      : null,
    coverageMissing: coverage ? null : "قياس الغطاء ما اتعملش — شغّل أداة الغطاء",
  });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return refusal(error) ?? NextResponse.json({ success: false, error: "الباب ما ردّش" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { tables?: unknown } | null;
  const tables = Array.isArray(body?.tables) ? body.tables.filter((t): t is string => typeof t === "string") : [];
  if (tables.length === 0) {
    return NextResponse.json({ success: false, error: "مطلوب اسم جدول واحد على الأقل عشان النسخة" }, { status: 400 });
  }

  // «*» is the nightly copy itself — the only run allowed to write the stamp, because the stamp is
  // what tells the restore door that a day has a verified copy behind it.
  const outcome = tables.includes("*") ? await runNightlySnapshot() : await runSnapshotForTables(tables);
  return NextResponse.json({
    success: outcome.failures.length === 0,
    day: outcome.day,
    tables: outcome.tables,
    rows: outcome.rows,
    bytes: outcome.bytes,
    writes: outcome.writes,
    failures: outcome.failures,
    error: outcome.failures.length ? outcome.failures[0] : undefined,
  });
}
