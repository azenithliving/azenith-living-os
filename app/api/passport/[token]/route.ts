/**
 * The customer's own address for one design sheet. No account, no password: the long
 * random token in the link is the whole login, and it opens exactly one sheet.
 *
 * GET  /api/passport/<token> — the sheet, with nothing that identifies the store or
 *      any other customer.
 * POST /api/passport/<token> — the customer's own numbers, and optionally his own mobile.
 *      When the numbers match what the store read, the sheet is confirmed and sealed; the
 *      seal is over those numbers, so a later change to the reading stops matching and says
 *      so. The mobile is stored as the roll's key, which is what makes «this number called,
 *      what did he draw?» answerable — see `lib/cad/sketch-link.ts`.
 *
 * Opening the sheet is also what the return counter measures. The same read records one visit per
 * device per window, keyed by a private label the phone keeps in its own storage and sends as a
 * header: it names nobody, only that the same eyes came back. That count is the third heat proof,
 * so a customer who never raised a paper and never shared the link is still visible to the owner.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyCustomerWitness, type SketchDimension } from "@/lib/cad/paper-sketch-parser";
import { linkFromPhone } from "@/lib/cad/sketch-link";
import { freezeHash, looksLikePassportToken, stillSealed } from "@/lib/cad/passport";
import { pickSheetImages } from "@/lib/cad/sheet-images";
import { recordVisit } from "@/lib/cad/sheet-visits";
import { roomTypeName } from "@/lib/cad/room-labels";
import { planFromPaper, type Plan } from "@/lib/cad/plan";
import { matrixFor, type ColourPick } from "@/lib/cad/colours";
import { rankByPicks } from "@/lib/cad/palette";

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
  /** What the walk of this paper's numbers produced. Absent on papers read before the drawing. */
  plan: Plan | null;
  /** The colours he chose for his room, up to three, each a colour the bank really holds. */
  colour_picks: ColourPick[] | null;
  /** Read for the write rules below. `publicSheet` never returns it: this is a public address. */
  customer_key: string | null;
  customer_city: string | null;
};

function publicSheet(
  row: Row,
  hasPhone: boolean,
  extras: { matrix: ReturnType<typeof matrixFor>; picks: ColourPick[] }
) {
  const dimensions = Array.isArray(row.dimensions) ? row.dimensions : [];
  // The stored drawing is the answer when there is one. When a paper predates the column — or was
  // filed before anyone picked a shape — the same builder runs, so no surface gets an empty box
  // and no surface gets a *different* room.
  const drawing = row.plan ? { plan: row.plan, question: null as string | null } : planFromPaper({ dimensions, openings: row.openings ?? [] });
  const plan = drawing.plan;
  return {
    // His heading is named in his Arabic whatever the row holds — the paper's own handwriting, a
    // bank key written by the room chip he tapped, or nothing. The bank still matches pictures on
    // the stored value, which is read before this line.
    room: roomTypeName(row.room) ?? null,
    dimensions,
    openings: Array.isArray(row.openings) ? row.openings : [],
    area_sqm: row.area_sqm ?? null,
    plan,
    // The one thing standing between the numbers on the paper and a drawing: his own answer.
    shape_question: plan ? null : drawing.question,
    // His colour matrix — the families his room's pictures really carry — and what he chose.
    colour_matrix: extras.matrix,
    colour_picks: extras.picks,
    confirmed_count: row.confirmed_count ?? 0,
    ok: Boolean(row.ok),
    failure: row.failure ?? null,
    confirmed_at: row.confirmed_at,
    sealed: Boolean(row.frozen_hash),
    // Does the seal still match the numbers on the sheet? A sheet that moved after
    // the customer signed it has to say so, not look unchanged.
    unchanged: stillSealed(row.frozen_hash, dimensions),
    customer_dimensions: row.customer_dimensions ?? null,
    // His own sheet may say the shop already holds his number; the number itself never leaves
    // the server, and the caller passes the boolean in so this function cannot echo a key.
    contact: { hasPhone, city: row.customer_city ?? null },
  };
}

async function findByToken(token: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { error: "المتجر غير متصل دلوقتي" as const, status: 503 };
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,token,room,dimensions,openings,area_sqm,confirmed_count,ok,failure,confirmed_at,frozen_hash,customer_dimensions,plan,colour_picks,customer_key,customer_city")
    .eq("token", token)
    .maybeSingle();
  if (error) return { error: "السجل ما ردّش" as const, status: 500 };
  if (!data) return { error: "مفيش ورقة بهذا العنوان" as const, status: 404 };
  return { row: data as Row, status: 200 };
}

/**
 * The sheet as a person reads it, with his room's pictures and the colour matrix they back.
 *
 * Both answers — the first read and the one after he confirms — go through here, so the page never
 * loses his matrix because one of the two doors forgot to compute it.
 */
async function sheetPayload(row: Row) {
  // The pictures are picked for the room on the drawing. When the room is one the
  // bank has no pictures for, the general house set is sent and the flag says so,
  // because «chosen for your room» has to be true before it is printed.
  const picks = await pickSheetImages(row.room, 20);
  const chosen = Array.isArray(row.colour_picks) ? row.colour_picks : [];
  return {
    sheet: publicSheet(row, Boolean(row.customer_key), { matrix: matrixFor(picks.images), picks: chosen }),
    // His own picks re-order the bank's list, so the first thing he sees is closest to what he said.
    images: rankByPicks(picks.images, chosen.map((pick) => pick.hex)),
    images_room_type: picks.roomType,
    images_for_his_room: picks.matched,
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikePassportToken(token)) {
    return NextResponse.json({ success: false, error: "العنوان غير صحيح" }, { status: 400 });
  }
  const found = await findByToken(token);
  if (!found.row) return NextResponse.json({ success: false, error: found.error }, { status: found.status });
  // Counted before the sheet is handed over, and never fatal: a visitor whose open could not be
  // stored still reads his paper, and the counter simply says one visit fewer than it saw.
  await recordVisit(found.row.id, request.headers.get("x-visit-key"));
  return NextResponse.json({ success: true, ...(await sheetPayload(found.row)) });
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

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  // His own digits are the strongest link there is — stronger than a clerk remembering whose
  // paper this was. Claimed before the numbers are compared, because identifying yourself and
  // agreeing with a reading are two different facts and the first one stands either way.
  // Never over the owner's link (`.is(...)`), and never fatal: if the write fails the desk
  // simply still says «من غير صاحب», which is the truth.
  const claimed = linkFromPhone(body?.customer_phone);
  if (claimed) {
    await supabase
      .from("room_sketches")
      .update({ customer_key: claimed.key })
      .eq("token", token)
      .is("customer_key", null);
  }

  const withCustomer = applyCustomerWitness(Array.isArray(row.dimensions) ? row.dimensions : [], typed);
  const confirmedCount = withCustomer.filter((d) => d.confirmed).length;

  if (confirmedCount === 0) {
    return NextResponse.json({
      success: true,
      matched: false,
      sheet: (await sheetPayload({ ...row, dimensions: withCustomer })).sheet,
      error: null,
      message: "الأرقام اللي كتبتها ما طابتش اللي قريناه — كلّمنانا ونعيد القراءة سوا",
    });
  }

  const confirmedDimensions = withCustomer.filter((d) => d.confirmed);
  // His agreement is what turns proposed walls into measured ones, so the drawing is re-walked
  // from the confirmed set in the same breath the sheet is sealed. The seal itself stays over the
  // numbers only — a shape chosen or a door dragged later must not invalidate his signature.
  const built = planFromPaper({
    dimensions: withCustomer,
    openings: row.openings ?? [],
    shape: row.plan?.shape ?? null,
  });
  const { error: updateError } = await supabase
    .from("room_sketches")
    .update({
      dimensions: withCustomer,
      customer_dimensions: typed,
      confirmed_count: confirmedCount,
      confirmed_at: new Date().toISOString(),
      frozen_hash: freezeHash(confirmedDimensions),
      plan: built.plan,
      area_sqm: built.plan?.complete ? built.plan.areaSqm : row.area_sqm,
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
    sheet: refreshed.row ? (await sheetPayload(refreshed.row)).sheet : null,
    message: "اتأكدت. دي ورقته المعتمدة بنفس الأرقام اللي كتبها.",
  });
}
