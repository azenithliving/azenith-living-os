/**
 * area-taste.ts — the one reader that decides what a customer's pictures are ordered by.
 *
 * Three things can order them, and the customer is told which one did: the colours he picked
 * himself, the colours his area's customers picked, or — when neither exists — the bank's own
 * quality order. The tier is decided here so the two doors that hand pictures to a customer (his
 * sheet and the WhatsApp delivery desk) cannot disagree about what they promised him.
 *
 * The brake: an area's taste is counted from stored rows only, never from a guess about a
 * neighbourhood, and a record that did not answer is reported as unreadable rather than as empty.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { rankByPicks } from "@/lib/cad/palette";
import { normalizeArea, tasteLine, tasteOfArea, type AreaEvidence, type AreaPaper, type TasteSource } from "@/lib/regions";

export type PaperFacts = {
  id: number | string | null;
  city?: string | null;
  picks?: { hex?: string | null }[] | null;
};

/** What the surface shows next to the pictures, and nothing the customer cannot read. */
export type SheetTaste = {
  source: TasteSource;
  line: string;
  area: string | null;
  papers: number;
  colours: string[];
};

/**
 * How many papers one read covers.
 *
 * The area is free text on the row, so matching it to the map happens here in words, not in a
 * `where` clause — which means the newest papers are what gets searched. Four hundred is well under
 * the store's cap and well over what an area could hold this year; when the roll outgrows it the
 * line will still be true, it will just be measured on the newest of them.
 */
const AREA_SCAN = 400;

/** Every paper that carries an area, newest first, with the colours its customer chose. */
async function papersWithArea(): Promise<{ rows: AreaPaper[]; readable: boolean }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [], readable: false };
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,customer_city,colour_picks")
    .not("customer_city", "is", null)
    .neq("customer_city", "")
    .order("created_at", { ascending: false })
    .limit(AREA_SCAN);
  if (error || !Array.isArray(data)) {
    console.warn(
      "[AreaTaste] the papers read failed, so no area taste is claimed:",
      String(error?.message ?? "السجل رد بشكل مش متوقّع"),
    );
    return { rows: [], readable: false };
  }
  const rows: AreaPaper[] = (data ?? []).map((row: any) => ({
    id: row.id ?? null,
    city: row.customer_city ? String(row.customer_city) : null,
    picks: Array.isArray(row.colour_picks) ? row.colour_picks : [],
  }));
  return { rows, readable: true };
}

function hexesOf(picks: AreaPaper["picks"]): string[] {
  return (picks ?? []).map((pick) => String(pick?.hex ?? "").trim()).filter((hex) => /^#?[\da-f]{6}$/i.test(hex));
}

function plain<T>(images: T[]): Array<T & { near: boolean }> {
  return images.map((image) => ({ ...image, near: false }));
}

function sheetTaste(source: TasteSource, evidence: AreaEvidence): SheetTaste {
  return {
    source,
    line: tasteLine(source, evidence),
    area: evidence.area,
    papers: evidence.papers,
    colours: evidence.colours,
  };
}

/**
 * His pictures, ordered by the strongest taste that actually exists for him.
 *
 * His own picks are never second to a neighbourhood's average, and an area tier is only claimed
 * when at least one *other* paper in it carries a colour — a customer cannot be his own evidence.
 */
export async function orderForPaper<T extends { color: string | null }>(
  images: T[],
  paper: PaperFacts,
): Promise<{ images: Array<T & { near: boolean }>; taste: SheetTaste }> {
  const area = normalizeArea(paper.city ?? "");
  const own = hexesOf(paper.picks);
  if (own.length) {
    return { images: rankByPicks(images, own), taste: sheetTaste("own", { area, papers: 0, hexes: own, colours: [] }) };
  }

  if (!area) return { images: plain(images), taste: sheetTaste("quality", { area: null, papers: 0, hexes: [], colours: [] }) };

  const { rows, readable } = await papersWithArea();
  if (!readable) {
    return { images: plain(images), taste: sheetTaste("unreadable", { area, papers: 0, hexes: [], colours: [] }) };
  }

  const evidence = tasteOfArea(rows, area, paper.id);
  if (!evidence.hexes.length) {
    return { images: plain(images), taste: sheetTaste("quality", evidence) };
  }
  return { images: rankByPicks(images, evidence.hexes), taste: sheetTaste("area", evidence) };
}
