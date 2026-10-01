/**
 * POST   /api/admin/ops/sketch — take a hand-drawn room, keep the paper, read it with
 *        both witnesses, and record what happened.
 * GET    /api/admin/ops/sketch — the readings, newest first. With `?customer_key=` it is
 *        only that customer's readings: the question the shop asks when his number shows
 *        up on the phone.
 * PATCH  /api/admin/ops/sketch — say whose paper an existing reading is.
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
import { parseSketchLink } from "@/lib/cad/sketch-link";
import { newPassportToken } from "@/lib/cad/passport";
import { syncLayer } from "@/lib/ops/memory/SyncLayer";

export const dynamic = "force-dynamic";
/**
 * The pixel witness needs room to finish. The local server never let it — but that
 * is a different machine from the one that serves the store, so the budget is opened
 * here and measured there rather than concluded from the dev run.
 */
export const maxDuration = 60;

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

  // 2. read it with both witnesses. The pixel one runs here on purpose: the local dev
  //    server is not the machine that serves the store, and there it never finished.
  //    So the real function is measured with an open budget before any redesign.
  const supplied = body?.offline_reading;
  const reading = await readPaperSketch({
    base64,
    mime,
    offline:
      supplied && typeof supplied === 'object' && typeof supplied.ran === 'boolean'
        ? {
            ran: supplied.ran,
            text: typeof supplied.text === 'string' ? supplied.text : '',
            confidence: typeof supplied.confidence === 'number' ? supplied.confidence : null,
            ms: typeof supplied.ms === 'number' ? supplied.ms : 0,
            error: typeof supplied.error === 'string' ? supplied.error : null,
          }
        : null,
  });

  // 3. record the reading, refused ones included — a refusal is evidence
  const { data: row, error: insertError } = await supabase
    .from("room_sketches")
    .insert({
      company_id: companyId,
      // Every reading gets its own private address from the moment it exists: the
      // customer confirms his numbers on that page, and that confirmation is the
      // witness the store can always count on.
      token: newPassportToken(),
      // A pointer at the roll, never a copy of a name: see `lib/cad/sketch-link.ts`.
      // Anything that is not a well-formed key is dropped rather than stored half-right.
      customer_key: parseSketchLink(body?.customer_key)?.key ?? null,
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
    .select("id, token, customer_key")
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
        customer_key: parseSketchLink(body?.customer_key)?.key ?? null,
      },
    });
  } catch {
    // A ledger that will not take the news does not undo the reading.
  }

  return NextResponse.json({
    success: true,
    id: row?.id ?? null,
    customer_key: row?.customer_key ?? null,
    passport_path: row?.token ? `/passport/${row.token}` : null,
    stored,
    storage_error: upload.error ? String(upload.error.message ?? upload.error).slice(0, 120) : null,
    reading,
  });
}

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  // `?customer_key=` answers «his number just called — what did he draw?». Only a well-formed
  // key is honoured; a malformed one is treated as no filter rather than a silent empty list,
  // because an empty list reads to the owner as «nothing on file».
  const wanted = parseSketchLink(request.nextUrl.searchParams.get("customer_key"));

  let query = supabase
    .from("room_sketches")
    .select("id,token,room,dimensions,openings,area_sqm,confirmed_count,ok,failure,image_path,created_at,witnesses,confirmed_at,frozen_hash,customer_key")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (wanted) query = query.eq("customer_key", wanted.key);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: "السجل ما ردّش" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sketches: data ?? [] });
}

/**
 * PATCH — say whose paper an existing reading is, or take the name off it.
 *
 * Scoped to this store by `company_id` in the same statement that does the writing: a
 * guessing script cannot relabel another company's reading, and cannot learn whether one
 * exists either (the row it gets back is only ever its own).
 */
export async function PATCH(request: NextRequest) {
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

  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, error: "مرفق رقم الورقة" }, { status: 400 });
  }

  // Absent means «unlink»: the desk sends the field every time, so a paper can be put back
  // to «من غير صاحب» without a second verb.
  const unlink = body?.customer_key === null || body?.customer_key === undefined || body?.customer_key === "";
  let key: string | null = null;
  if (!unlink) {
    const link = parseSketchLink(body.customer_key);
    if (!link) {
      return NextResponse.json(
        { success: false, error: "المفتاح مش مفتاح عميل — اختار من الدفتر" },
        { status: 400 }
      );
    }
    key = link.key;
  }

  const { data, error } = await supabase
    .from("room_sketches")
    .update({ customer_key: key })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, customer_key");

  if (error) {
    return NextResponse.json({ success: false, error: "السجل رفض الربط" }, { status: 500 });
  }
  if (!data?.length) {
    return NextResponse.json({ success: false, error: "مفيش ورقة بهذا الرقم" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id: data[0].id, customer_key: data[0].customer_key ?? null });
}
