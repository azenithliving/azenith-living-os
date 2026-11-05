/**
 * /api/admin/backup/restore — the one door that can put rows back into the owner's record.
 *
 * It is built as refusals: the table must be in the copy's set, the stamp must carry the asked day,
 * the copy's own read-back must have agreed, and without the owner's word carried in the request the
 * only rows that may return are the ones carrying the caller's marker. Rows that already exist are
 * never overwritten — this door inserts, it does not repair.
 */

import { NextRequest, NextResponse } from "next/server";

import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { SNAPSHOT_STAMP_KEY, loadSnapshotRows } from "@/lib/ops/nightly-snapshot";
import { planRestore, rowsToInsert } from "@/lib/ops/restore-plan";

export const dynamic = "force-dynamic";

function refusal(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json({ success: false, error: "لازم تكون داخل بلوحة التحكم قبل ما السطور ترجع" }, { status: error.status })
    : null;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    return refusal(error) ?? NextResponse.json({ success: false, error: "الباب ما ردّش" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as {
    day?: unknown;
    table?: unknown;
    marker?: unknown;
    ownerWord?: unknown;
  } | null;
  const day = typeof body?.day === "string" ? body.day : "";
  const table = typeof body?.table === "string" ? body.table : "";
  const marker = typeof body?.marker === "string" ? body.marker : "";
  const ownerWord = typeof body?.ownerWord === "string" ? body.ownerWord : "";

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "مفتاح الخدمة مش ضابط — الاسترجاع مرفوض" }, { status: 503 });
  }

  const stamped = await supabase.from("site_settings").select("value").eq("key", SNAPSHOT_STAMP_KEY).maybeSingle();
  if (stamped.error) {
    return NextResponse.json({ success: false, error: `ختم النسخة ما اتقراش (${stamped.error.message})` }, { status: 502 });
  }
  const plan = planRestore({ day, table, stamp: (stamped.data?.value as any) ?? null, marker, ownerWord });
  if (!plan.ok) {
    return NextResponse.json({ success: false, error: plan.reason }, { status: 400 });
  }

  const copy = await loadSnapshotRows(plan.day, plan.table);
  if (copy.error) {
    return NextResponse.json({ success: false, error: copy.error, parsed: copy.parsed }, { status: 502 });
  }

  const wanted =
    plan.scope === "marker"
      ? copy.rows.filter((row) => JSON.stringify(row).includes(plan.marker))
      : copy.rows;
  if (plan.scope === "marker" && wanted.length === 0) {
    return NextResponse.json(
      { success: false, error: `ولا سطر في النسخة عليه العلامة «${plan.marker}» — الاسترجاع مرفوض` },
      { status: 400 },
    );
  }

  const key = plan.target.order;
  const live = await supabase.from(plan.table).select(key);
  if (live.error) {
    return NextResponse.json({ success: false, error: `السطور الموجودة ما اتقراش (${live.error.message})` }, { status: 502 });
  }

  const asRows = (rows: unknown) => (Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []);

  let missing;
  try {
    missing = rowsToInsert(wanted, asRows(live.data), key as never);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
  if (missing.length === 0) {
    return NextResponse.json({
      success: true,
      scope: plan.scope,
      table: plan.table,
      day: plan.day,
      inCopy: wanted.length,
      inserted: 0,
      alreadyThere: wanted.length,
      readBack: 0,
      note: "كل السطور الموجودة في النسخة موجودة في السجل — ولا سطر اترجّع ولا سطر اتعدّل",
    });
  }

  const inserted = await supabase.from(plan.table).insert(missing);
  if (inserted.error) {
    return NextResponse.json({ success: false, error: `الرجوع مرفوض من السجل (${inserted.error.message})` }, { status: 502 });
  }

  const keys = missing.map((r) => String(r[key]));
  const check = await supabase.from(plan.table).select(key).in(key, keys);
  if (check.error) {
    return NextResponse.json(
      { success: false, error: `الرجوع اتكتب بس ما اتقراش (${check.error.message})` },
      { status: 502 },
    );
  }
  const readBackRows = asRows(check.data);
  const readBack = readBackRows.length;
  const leftovers = keys.filter((k) => !readBackRows.some((row) => String(row[key]) === k));

  return NextResponse.json({
    success: readBack === keys.length,
    scope: plan.scope,
    table: plan.table,
    day: plan.day,
    inCopy: wanted.length,
    inserted: keys.length,
    alreadyThere: wanted.length - missing.length,
    readBack,
    leftovers,
    error: readBack === keys.length ? undefined : `رجعنا ${keys.length} والسجل بيقول ${readBack}`,
  });
}
