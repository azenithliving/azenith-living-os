/**
 * app/api/sheet — the customer files his own paper and gets his private sheet address.
 *
 * Measured 2026-10-07 walking the journey: the ONLY door that minted a passport token was the
 * owner's sketch desk, and `/request` carried zero links to `/passport/*`. So the customer's
 * journey had no front door — it could only be started by the owner on his behalf. This is that door.
 *
 * What it deliberately does NOT do: read the picture. The cloud reader is refused tonight
 * («مفيش مفتاح شغال دلوقتي»), and the on-device reader never finished inside a request (measured
 * 0 of 17 stored readings, and 0 of 6 again at 40 seconds). A door that pretends to read would
 * hand the customer an empty lie; this one keeps his paper, gives him his address, and lets him
 * write his own numbers — which is the witness that always answers.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePrimaryCompanyId } from "@/lib/company-resolver";
import { linkFromPhone } from "@/lib/cad/sketch-link";
import { newPassportToken } from "@/lib/cad/passport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The same ceiling the store's other picture doors carry. */
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const raw = typeof (body as any)?.image === "string" ? (body as any).image : "";
  if (!raw) {
    return NextResponse.json({ success: false, error: "مرفق صورة الورقة" }, { status: 400 });
  }

  const phone = linkFromPhone((body as any)?.phone);
  if (!phone) {
    return NextResponse.json({
      success: false,
      error: "رقم موبايل مصري صحيح مطلوب عشان الورقة تبقى ليك إنت",
    }, { status: 400 });
  }

  const { base64, mime } = splitDataUrl(raw);
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { success: false, error: `حجم الصورة غير مقبول (${buffer.length} بايت، الحد ${MAX_IMAGE_BYTES})` },
      { status: 400 }
    );
  }

  const companyId = await resolvePrimaryCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  const type = mime ?? "image/png";
  const path = `sketches/${companyId}/${Date.now()}_${phone.value}.${EXT_BY_MIME[type] ?? "png"}`;
  const upload = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: type, upsert: false });
  const stored = !upload.error;

  const token = newPassportToken();
  const { data: row, error: insertError } = await supabase
    .from("room_sketches")
    .insert({
      company_id: companyId,
      token,
      customer_key: phone.key,
      image_path: stored ? path : null,
      // No reading is claimed. The paper is his; the numbers will be his too until a witness answers.
      dimensions: [],
      openings: [],
      confirmed_count: 0,
      ok: false,
      failure: "الورقة مستنية — اكتب مقاساتك عليها وهتتقفل بيك",
      witnesses: {
        offline: { ran: false, ms: 0, confidence: null, error: "مش مطلوب جوه الطلب" },
        model_reader: null,
        bytes: buffer.length,
        mime: type,
      },
    })
    .select("id, token")
    .single();

  if (insertError || !row) {
    console.warn(`[SheetDoor] insert refused: ${String(insertError?.message ?? "بلا سبب")}`);
    return NextResponse.json({ success: false, error: "ما قدرناش نسجّل الورقة دلوقتي" }, { status: 500 });
  }

  console.log(`[SheetDoor] sheet ${row.id} filed by ${phone.key} · stored=${stored} · bytes ${buffer.length}`);
  return NextResponse.json({
    success: true,
    sheet_id: row.id,
    passport_path: `/passport/${token}`,
    stored,
    message: "ورقتك اتسجلت — ده عنوانك السرّي، اكتب عليه مقاساتك وكل اللي معاك يقدروا يصوّتوا",
  });
}
