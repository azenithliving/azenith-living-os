/**
 * The contact desk, behind the same secret address as the sheet.
 *
 * POST /api/passport/<token>/contact — { phone, city?, room? }
 *
 * This is the moment the council agreed the store asks for his number: not a form at the end
 * of a session, but the second he wants three furnishing suggestions delivered to his own
 * phone. The answer carries the pictures it actually found in the bank, and the line above
 * them says what the bank can really claim — it holds room types, not furniture dimensions.
 *
 * Every write is read back from the table before it is reported, because a door that answers
 * from its own intention is how a screen starts showing a customer who was never stored.
 */
import { NextRequest, NextResponse } from "next/server";

import { looksLikePassportToken } from "@/lib/cad/passport";
import { offerLine, planClaim } from "@/lib/cad/contact";
import { pickSheetImages } from "@/lib/cad/sheet-images";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Paper = { id: number; customer_key: string | null; customer_city: string | null; room: string | null };

async function findByToken(token: string): Promise<Paper | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,customer_key,customer_city,room")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: Number(data.id),
    customer_key: data.customer_key ? String(data.customer_key) : null,
    customer_city: data.customer_city ? String(data.customer_city) : null,
    room: data.room ? String(data.room) : null,
  };
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

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  const paper = await findByToken(token);
  if (!paper) return NextResponse.json({ success: false, error: "مفيش ورقة بهذا العنوان" }, { status: 404 });

  const claim = planClaim({ phone: body?.phone, city: body?.city, room: body?.room }, paper);
  if (claim.refusal) return NextResponse.json({ success: false, error: claim.refusal }, { status: 400 });

  const keys = Object.keys(claim.write);
  if (keys.length > 0) {
    let query = supabase.from("room_sketches").update(claim.write).eq("id", paper.id);
    // The owner's link is never overwritten, whoever typed after him.
    if (claim.write.customer_key) query = query.is("customer_key", null);
    const { error } = await query;
    if (error) {
      console.warn("[PassportContact] the claim was not stored:", error.message);
      return NextResponse.json({ success: false, error: "السجل رفض الرقم" }, { status: 500 });
    }
  }

  const stored = await findByToken(token);
  const wrote = keys.length;
  const kept = [
    stored?.customer_key ? "رقم" : null,
    stored?.customer_city ? "منطقة" : null,
    stored?.room ? "نوع غرفة" : null,
  ].filter(Boolean);
  console.log(`[PassportContact] paper ${paper.id}: asked to write ${wrote}, the table now holds ${kept.join("+") || "nothing"}`);

  const picks = await pickSheetImages(claim.roomFor, 3);
  return NextResponse.json({
    success: true,
    line: offerLine(picks.images.length, picks.matched),
    picks,
    stored: {
      hasPhone: Boolean(stored?.customer_key),
      city: stored?.customer_city ?? null,
      room: stored?.room ?? null,
    },
  });
}
