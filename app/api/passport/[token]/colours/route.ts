/**
 * The colour desk, behind the same secret address as the sheet.
 *
 * POST /api/passport/<token>/colours — { picks: [{ family, hex }] }
 *
 * He is choosing a taste, not a measurement, so nothing here can move a sealed number: the write
 * touches one column and nothing else. What is checked before that is whether the shop can back
 * the colour with pictures of his own room — a preference the bank cannot show would turn into a
 * promise he hears on the phone.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { looksLikePassportToken } from "@/lib/cad/passport";
import { pickSheetImages } from "@/lib/cad/sheet-images";
import { cleanPicks, matrixFor, type ColourPick } from "@/lib/cad/colours";
import { factsFromPaper, rememberFacts } from "@/lib/customers/memory";

export const dynamic = "force-dynamic";

type Row = { id: number; room: string | null; colour_picks: ColourPick[] | null; customer_key: string | null; company_id: string | null };

async function findByToken(token: string): Promise<Row | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,room,colour_picks,customer_key,company_id")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: Number(data.id),
    room: data.room ? String(data.room) : null,
    colour_picks: Array.isArray(data.colour_picks) ? (data.colour_picks as ColourPick[]) : null,
    customer_key: data.customer_key ? String(data.customer_key) : null,
    company_id: data.company_id ? String(data.company_id) : null,
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

  const row = await findByToken(token);
  if (!row) return NextResponse.json({ success: false, error: "مفيش ورقة بهذا العنوان" }, { status: 404 });

  // The matrix is recomputed from the bank rather than trusted from the screen: what he may pick is
  // exactly what the shop can show him for his room, at this moment.
  const picks = await pickSheetImages(row.room, 20);
  const matrix = matrixFor(picks.images);
  const cleaned = cleanPicks(body?.picks, matrix);
  if (cleaned.refusal) return NextResponse.json({ success: false, error: cleaned.refusal }, { status: 400 });

  const { error: writeError } = await supabase.from("room_sketches").update({ colour_picks: cleaned.picks }).eq("id", row.id);
  if (writeError) {
    console.warn("[PassportColours] paper", row.id, "the colours were not stored:", writeError.message);
    return NextResponse.json({ success: false, error: "السجل رفض الألوان" }, { status: 500 });
  }

  const stored = await findByToken(token);
  console.log(
    `[PassportColours] paper ${row.id}: asked to keep ${cleaned.picks.length}, the table holds ${(stored?.colour_picks ?? []).length} of ${matrix.length} offered`
  );

  // A colour he stopped on is his own word, and it outlives the paper: written under his key so the
  // next visit — or the next room — starts from what the shop already knows about him.
  if (stored?.customer_key) {
    const memory = await rememberFacts(stored.customer_key, stored.company_id, factsFromPaper(stored));
    if (memory.failures.length) console.warn("[PassportColours] الذاكرة ما اكتملتش:", memory.failures.join(" | "));
  }

  return NextResponse.json({
    success: true,
    picks: stored?.colour_picks ?? cleaned.picks,
    matrix,
    matched: picks.matched,
  });
}
