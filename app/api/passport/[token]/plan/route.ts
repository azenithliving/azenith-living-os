/**
 * The drawing desk, behind the same secret address as the sheet.
 *
 * POST /api/passport/<token>/plan — { shape?, openings? }
 *
 * Two things a customer can say about his own room without touching a measurement: which shape
 * the place is, and where the door sits along its wall. Both are walked here through the store's
 * single geometry builder, so what is stored is exactly what a sheet could be shown — and the
 * numbers on the paper are never in the patch, which is what keeps his seal valid after he drags.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { looksLikePassportToken } from "@/lib/cad/passport";
import { DRAWABLE_SHAPES, SHAPE_LABELS, planFromPaper, type PaperDimension, type PaperOpening, type Plan, type PlanShape } from "@/lib/cad/plan";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  dimensions: PaperDimension[] | null;
  openings: PaperOpening[] | null;
  area_sqm: number | string | null;
  plan: Plan | null;
};

/** Only a template the store can actually walk; anything else is named in words he can pick from. */
function readShape(value: unknown): { shape: PlanShape | null; refusal: string | null } {
  if (value === undefined || value === null || value === "") return { shape: null, refusal: null };
  const wanted = String(value).trim();
  if ((DRAWABLE_SHAPES as string[]).includes(wanted)) return { shape: wanted as PlanShape, refusal: null };
  // The word he sent is not echoed back: a shape key on his sheet reads like a machine talking.
  return { shape: null, refusal: `اختار شكل تقدر ترسمه: ${DRAWABLE_SHAPES.map((s) => SHAPE_LABELS[s]).join(" ولا ")}.` };
}

async function findByToken(token: string): Promise<Row | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,dimensions,openings,area_sqm,plan")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: Number(data.id),
    dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
    openings: Array.isArray(data.openings) ? data.openings : [],
    area_sqm: data.area_sqm ?? null,
    plan: (data.plan as Plan) ?? null,
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

  const { shape, refusal } = readShape(body?.shape);
  if (refusal) return NextResponse.json({ success: false, error: refusal }, { status: 400 });

  const moved = Array.isArray(body?.openings) && body.openings.length > 0;
  if (!shape && !moved) {
    return NextResponse.json({ success: false, error: "قولي شكل المكان ولا فين الباب على ضلعه" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  const row = await findByToken(token);
  if (!row) return NextResponse.json({ success: false, error: "مفيش ورقة بهذا العنوان" }, { status: 404 });

  // The customer's dragged list wins; otherwise the sheet's own last drawing is re-walked so a
  // shape change does not erase where he put the door.
  const openings = (moved ? body.openings : row.plan?.openings ?? row.openings ?? []) as PaperOpening[];
  const built = planFromPaper({ dimensions: row.dimensions ?? [], openings, shape: shape ?? row.plan?.shape ?? null });

  if (!built.plan) {
    return NextResponse.json({ success: false, error: built.question ?? "الرسم ما اتكملش" }, { status: 400 });
  }

  const patch = {
    plan: built.plan,
    // The polygon's area when the room closes; the sheet's earlier number while it does not.
    area_sqm: built.plan.complete ? built.plan.areaSqm : row.area_sqm,
  };
  const { error: writeError } = await supabase.from("room_sketches").update(patch).eq("id", row.id);
  if (writeError) {
    console.warn("[PassportPlan] paper", row.id, "the drawing was not stored:", writeError.message);
    return NextResponse.json({ success: false, error: "السجل رفض الرسم" }, { status: 500 });
  }

  const stored = await findByToken(token);
  console.log(
    `[PassportPlan] paper ${row.id}: asked to draw ${shape ?? "openings only"}, the table holds ${stored?.plan?.walls?.length ?? 0} walls` +
      ` and ${stored?.plan?.openings?.length ?? 0} openings`
  );

  return NextResponse.json({
    success: true,
    plan: stored?.plan ?? built.plan,
    area_sqm: stored?.area_sqm ?? patch.area_sqm,
    conflicts: stored?.plan?.conflicts ?? built.plan.conflicts,
  });
}
