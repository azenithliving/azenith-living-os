/**
 * The customer's own address for one design sheet. No account, no password: the long
 * random token in the link is the whole login, and it opens exactly one sheet.
 *
 * GET  /api/passport/<token> — the sheet, with nothing that identifies the store or
 *      any other customer.
 * POST /api/passport/<token> — the customer's own numbers. When they match what the
 *      store read, the sheet is confirmed and sealed; the seal is over those numbers,
 *      so a later change to the reading stops matching and says so.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyCustomerWitness, type SketchDimension } from "@/lib/cad/paper-sketch-parser";
import { freezeHash, looksLikePassportToken, stillSealed } from "@/lib/cad/passport";
import { pickSheetImages } from "@/lib/cad/sheet-images";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  token: string | null;
  room: string | null;
  dimensions: SketchDimension[];
  openings: { kind: string; widthMeters: number | null }[];
  area_sqm: number | string | null;
  confirmed_count: number;
  ok: boolean;
  failure: string | null;
  confirmed_at: string | null;
  frozen_hash: string | null;
  customer_dimensions: number[] | null;
};

function publicSheet(row: Row) {
  const dimensions = Array.isArray(row.dimensions) ? row.dimensions : [];
  return {
    room: row.room ?? null,
    dimensions,
    openings: Array.isArray(row.openings) ? row.openings : [],
    area_sqm: row.area_sqm ?? null,
    confirmed_count: row.confirmed_count ?? 0,
    ok: Boolean(row.ok),
    failure: row.failure ?? null,
    confirmed_at: row.confirmed_at,
    sealed: Boolean(row.frozen_hash),
    // Does the seal still match the numbers on the sheet? A sheet that moved after
    // the customer signed it has to say so, not look unchanged.
    unchanged: stillSealed(row.frozen_hash, dimensions),
    customer_dimensions: row.customer_dimensions ?? null,
  };
}

async function findByToken(token: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "المتجر غير متصل دلوقتي" as const, status: 503 };
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,token,room,dimensions,openings,area_sqm,confirmed_count,ok,failure,confirmed_at,frozen_hash,customer_dimensions")
    .eq("token", token)
    .maybeSingle();
  if (error) return { error: "السجل ما ردّش" as const, status: 500 };
  if (!data) return { error: "مفيش ورقة بهذا العنوان" as const, status: 404 };
  return { row: data as Row, status: 200 };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikePassportToken(token)) {
    return NextResponse.json({ success: false, error: "العنوان غير صحيح" }, { status: 400 });
  }
  const found = await findByToken(token);
  if (!found.row) return NextResponse.json({ success: false, error: found.error }, { status: found.status });

  // The pictures are picked for the room on the drawing. When the room is one the
  // bank has no pictures for, the general house set is sent and the flag says so,
  // because «chosen for your room» has to be true before it is printed.
  const picks = await pickSheetImages(found.row.room, 20);

  return NextResponse.json({
    success: true,
    sheet: publicSheet(found.row),
    images: picks.images,
    images_room_type: picks.roomType,
    images_for_his_room: picks.matched,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikePassportToken(token)) {
    return NextResponse.json({ success: false, error: "العنوان غير صحيح" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const typed = (Array.isArray(body?.dimensions) ? body.dimensions : [])
    .map((v: unknown) => Number(v))
    .filter((v: number) => Number.isFinite(v) && v > 0 && v < 200)
    .slice(0, 12);

  if (typed.length === 0) {
    return NextResponse.json({ success: false, error: "اكتب مقاس واحد على الأقل" }, { status: 400 });
  }

  const found = await findByToken(token);
  if (!found.row) return NextResponse.json({ success: false, error: found.error }, { status: found.status });

  const row = found.row;
  if (row.confirmed_at) {
    return NextResponse.json({ success: false, error: "الورقة دي اتاكدت قبل كده" }, { status: 409 });
  }

  const withCustomer = applyCustomerWitness(Array.isArray(row.dimensions) ? row.dimensions : [], typed);
  const confirmedCount = withCustomer.filter((d) => d.confirmed).length;

  if (confirmedCount === 0) {
    return NextResponse.json({
      success: true,
      matched: false,
      sheet: publicSheet({ ...row, dimensions: withCustomer }),
      error: null,
      message: "الأرقام اللي كتبتها ما طابتش اللي قريناه — كلّمنانا ونعيد القراءة سوا",
    });
  }

  const supabase = getSupabaseAdminClient();
  const confirmedDimensions = withCustomer.filter((d) => d.confirmed);
  const { error: updateError } = await supabase!
    .from("room_sketches")
    .update({
      dimensions: withCustomer,
      customer_dimensions: typed,
      confirmed_count: confirmedCount,
      confirmed_at: new Date().toISOString(),
      frozen_hash: freezeHash(confirmedDimensions),
      ok: true,
      failure: null,
    })
    .eq("token", token);

  if (updateError) {
    return NextResponse.json({ success: false, error: "السجل رفض التأكيد" }, { status: 500 });
  }

  const refreshed = await findByToken(token);
  return NextResponse.json({
    success: true,
    matched: true,
    sheet: refreshed.row ? publicSheet(refreshed.row) : null,
    message: "اتأكدت. دي ورقته المعتمدة بنفس الأرقام اللي كتبها.",
  });
}
