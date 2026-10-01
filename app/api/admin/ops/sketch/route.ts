/**
 * POST /api/admin/ops/sketch — take a hand-drawn room, keep the paper, read it with
 * both witnesses, and record what happened.
 * GET  /api/admin/ops/sketch — the readings, newest first.
 *
 * The order matters. The paper is stored before it is read, because a reading that
 * cannot be re-opened against the original is an accusation nobody can check. If the
 * store refuses the file, the reading is still returned and `stored: false` says so —
 * the measurement is not held hostage to the filing cabinet.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { readPaperSketch } from "@/lib/cad/paper-sketch-parser";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";

export const dynamic = "force-dynamic";

/** Same ceiling the store's other picture door carries. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const BUCKET = "customer-uploads";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function splitDataUrl(raw: string): { base64: string; mime: string | null } {
  const match = raw.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/);
  if (match) return { base64: match[3], mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
  return { base64: raw, mime: null };
}

export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const raw = typeof body?.image_base64 === "string" ? body.image_base64 : "";
  if (!raw) {
    return NextResponse.json({ success: false, error: "مرفق صورة الورقة" }, { status: 400 });
  }

  const { base64, mime: detectedMime } = splitDataUrl(raw);
  const mime = detectedMime || (typeof body?.mime === "string" ? body.mime : "image/png");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { success: false, error: `حجم الصورة غير مقبول (${buffer.length} بايت، الحد ${MAX_IMAGE_BYTES})` },
      { status: 400 }
    );
  }

  // 1. keep the paper
  const extension = EXT_BY_MIME[mime] ?? "png";
  const path = `sketches/${companyId}/${Date.now()}.${extension}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });
  const stored = !upload.error;

  // 2. read it twice
  const reading = await readPaperSketch({ base64, mime });

  // 3. record the reading, refused ones included — a refusal is evidence
  const { data: row, error: insertError } = await supabase
    .from("room_sketches")
    .insert({
      company_id: companyId,
      customer_key: typeof body?.customer_key === "string" ? body.customer_key.slice(0, 80) : null,
      image_path: stored ? path : null,
      room: reading.room,
      dimensions: reading.dimensions,
      openings: reading.openings,
      area_sqm: reading.areaSqm,
      confirmed_count: reading.confirmedCount,
      ok: reading.ok,
      failure: reading.failure,
      witnesses: {
        offline: { ran: reading.ocr.ran, ms: reading.ocr.ms, confidence: reading.ocr.confidence, error: reading.ocr.error },
        bytes: buffer.length,
        mime,
      },
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json(
      {
        success: false,
        error: `السجل رفض الحفظ: ${String(insertError.message ?? insertError.code ?? insertError).slice(0, 140)}`,
        reading,
        stored,
      },
      { status: 500 }
    );
  }

  // 4. tell the store a customer handed over a plan
  try {
    await syncLayer.initialize(companyId);
    await syncLayer.publish({
      event_type: "paper_sketch_received",
      source_agent: "ops-lead",
      target_agents: [],
      payload: {
        sketch_id: row?.id ?? null,
        ok: reading.ok,
        dimensions: reading.dimensions.length,
        confirmed: reading.confirmedCount,
        customer_key: typeof body?.customer_key === "string" ? body.customer_key : null,
      },
    });
  } catch {
    // A ledger that will not take the news does not undo the reading.
  }

  return NextResponse.json({
    success: true,
    id: row?.id ?? null,
    stored,
    storage_error: upload.error ? String(upload.error.message ?? upload.error).slice(0, 120) : null,
    reading,
  });
}

export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,room,dimensions,openings,area_sqm,confirmed_count,ok,failure,image_path,created_at,witnesses")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ success: false, error: "السجل ما ردّش" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sketches: data ?? [] });
}
