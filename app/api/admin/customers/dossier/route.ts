/**
 * GET /api/admin/customers/dossier?customer_key=<roll key>
 *
 * The golden file the owner reads before he dials: the man, his paper, the numbers on that
 * paper, the colours his room would be built from — and the two things this store cannot
 * answer about him, printed in the same voice as the things it can.
 *
 * Three doors' truth assembled once, server-side: the roll is read by `lib/customers/read.ts`
 * (the same reader the customers screen uses, so the file cannot disagree with the desk), the
 * papers are the readings already linked to his key, and the colours are the dominant colour
 * the image bank stores on each picture. The assembly and the honesty rule live in
 * `lib/cad/dossier.ts`; this route only carries it and the paper's own photo.
 *
 * Read-only. The photo is a short-lived signed address for one file, and the customer's sheet
 * token is only ever returned for his own papers.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { readCustomers } from "@/lib/customers/read";
import { parseSketchLink } from "@/lib/cad/sketch-link";
import { pickSheetImages } from "@/lib/cad/sheet-images";
import { readVotesForSketches } from "@/lib/cad/family-votes";
import { buildDossier, paperPath, type DossierSketch } from "@/lib/cad/dossier";

export const dynamic = "force-dynamic";

const BUCKET = "customer-uploads";
/** Half an hour: long enough to open the file during a call, short enough not to become a link. */
const PHOTO_TTL_SECONDS = 30 * 60;

type PaperRow = {
  id: number;
  token: string | null;
  room: string | null;
  customer_city?: string | null;
  dimensions: DossierSketch["dimensions"];
  area_sqm: number | string | null;
  ok: boolean;
  confirmed_at: string | null;
  frozen_hash: string | null;
  created_at: string;
  image_path: string | null;
};

export async function GET(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  // A malformed key is refused, not filtered: an empty file reads to the owner as «this man
  // has nothing», while the real answer is «that is not how the roll names a person».
  const wanted = parseSketchLink(request.nextUrl.searchParams.get("customer_key"));
  if (!wanted) {
    return NextResponse.json({ success: false, error: "اختار العميل من الدفتر الأول" }, { status: 400 });
  }

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });
  }

  const roll = await readCustomers(supabase);
  if (roll.failures.length > 0) {
    return NextResponse.json({ success: false, error: "الدفتر ما ردّش — الملف اتبنى على نص الحقيقة" }, { status: 500 });
  }
  const line = roll.customers.find((row) => row.key === wanted.key) ?? null;
  if (!line) {
    return NextResponse.json({ success: false, error: "مفيش عميل بالاسم ده في الدفتر" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,token,room,customer_city,dimensions,area_sqm,ok,confirmed_at,frozen_hash,created_at,image_path")
    .eq("company_id", companyId)
    .eq("customer_key", wanted.key)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    return NextResponse.json({ success: false, error: "سجل الورقات ما ردّش" }, { status: 500 });
  }
  const papers = (data ?? []) as unknown as PaperRow[];

  // The colours come from the pictures that fit the room on his newest paper. When that room
  // is one the bank holds no pictures for, `pickSheetImages` says so and the file reports the
  // house palette as the house palette instead of dressing it up as «picked for him».
  const newest = papers[0] ?? null;
  const picks = await pickSheetImages(newest?.room, 12);

  const photo = await photoUrl(supabase, newest?.image_path);

  // What his family stopped on, from the vote desk. Read over every paper he owns, because the
  // link he shares is per paper and a man with three rooms has three links.
  const votes = await readVotesForSketches(papers.map((paper) => paper.id));

  const dossier = buildDossier({
    line,
    sketches: papers.map((p) => ({
      id: p.id,
      token: p.token ?? null,
      room: p.room ?? null,
      customer_city: p.customer_city ?? null,
      dimensions: Array.isArray(p.dimensions) ? p.dimensions : [],
      area_sqm: p.area_sqm ?? null,
      ok: Boolean(p.ok),
      confirmed_at: p.confirmed_at ?? null,
      frozen_hash: p.frozen_hash ?? null,
      created_at: p.created_at,
    })),
    images: picks.images,
    imagesRoomType: picks.roomType,
    imagesForHisRoom: picks.matched,
    votes,
  });

  return NextResponse.json({
    success: true,
    ...dossier,
    papers: papers.map((p) => ({
      id: p.id,
      created_at: p.created_at,
      sheet_path: p.token ? paperPath(p.token) : null,
      photo_url: p.id === newest?.id ? photo : null,
    })),
  });
}

/** The owner's own look at the hand-drawn paper. Null when the bank has nothing to show. */
async function photoUrl(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, PHOTO_TTL_SECONDS);
  return error || !data?.signedUrl ? null : String(data.signedUrl);
}
