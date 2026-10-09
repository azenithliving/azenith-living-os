/**
 * area-taste.ts — the one reader that decides what a customer's pictures are ordered by.
 *
 * Four things can order them, and the customer is told which one did: the colours he picked
 * himself, then his area's measured taste — the colours on his area's papers and the styles his
 * area's visitors asked for — or, when nothing was measured, the bank's own quality order. The
 * tier is decided here so the two doors that hand pictures to a customer (his sheet and the
 * WhatsApp delivery desk) cannot disagree about what they promised him.
 *
 * The brake: an area's taste is counted from stored rows only, never from a guess about a
 * neighbourhood, and a record that did not answer is reported as unreadable rather than as empty.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { rankByPicks } from "@/lib/cad/palette";
import { STYLE_LABELS } from "@/lib/constants/rooms";
import { styleKey } from "@/lib/taste-words";
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
  /** How many visitors of his area asked for a style, and the styles they said. */
  visitors: number;
  styles: string[];
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

/**
 * Every visitor who carries an area, newest first, with the style he asked for.
 *
 * The second source of an area's taste: the sheet only ever sees a customer who reached his paper,
 * while the advisor's own conversations record what a visitor wanted. A row with an area and no
 * style is skipped, because a place with no asking tells the ranking nothing.
 */
async function visitorsWithArea(): Promise<{ rows: { area: string; style: string | null }[]; readable: boolean }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [], readable: false };
  const { data, error } = await supabase
    .from("users")
    .select("area,style")
    .not("area", "is", null)
    .neq("area", "")
    .order("created_at", { ascending: false })
    .limit(AREA_SCAN);
  if (error || !Array.isArray(data)) {
    console.warn(
      "[AreaTaste] the visitors read failed, so no area taste is claimed:",
      String(error?.message ?? "السجل رد بشكل مش متوقّع"),
    );
    return { rows: [], readable: false };
  }
  return {
    rows: (data as any[]).map((row) => ({ area: String(row.area ?? ""), style: row.style ? String(row.style) : null })),
    readable: true,
  };
}

/** The styles his area asked for, most-asked first, with how many rows carried one. */
function areaStyles(rows: { area: string; style: string | null }[], area: string) {
  const counts = new Map<string, number>();
  let holders = 0;
  for (const row of rows) {
    if (normalizeArea(row.area) !== area) continue;
    const key = styleKey(row.style ?? "");
    if (!key) continue;
    holders++;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const keys = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key);
  return { visitors: holders, keys, labels: keys.map((key) => STYLE_LABELS[key]).filter(Boolean) };
}

/** His area's requested styles first, each group keeping the order it already had. */
function orderByStyle<T extends { style?: string | null }>(rows: T[], keys: string[]): T[] {
  if (!keys.length) return rows;
  const wanted = rows.filter((row) => row.style && keys.includes(row.style));
  const rest = rows.filter((row) => !row.style || !keys.includes(row.style));
  return [...wanted, ...rest];
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
    visitors: evidence.visitors ?? 0,
    styles: evidence.styleLabels ?? [],
  };
}

/**
 * His pictures, ordered by the strongest taste that actually exists for him.
 *
 * His own picks are never second to a neighbourhood's average. An area tier is claimed when either
 * door measured something: colours on his area's papers, or styles on his area's visitors — and a
 * customer cannot be his own evidence, so his own paper is dropped from the count.
 */
export async function orderForPaper<T extends { color: string | null; style?: string | null }>(
  images: T[],
  paper: PaperFacts,
): Promise<{ images: Array<T & { near: boolean }>; taste: SheetTaste }> {
  const area = normalizeArea(paper.city ?? "");
  const own = hexesOf(paper.picks);
  if (own.length) {
    return { images: rankByPicks(images, own), taste: sheetTaste("own", { area, papers: 0, hexes: own, colours: [] }) };
  }

  if (!area) return { images: plain(images), taste: sheetTaste("quality", { area: null, papers: 0, hexes: [], colours: [] }) };

  const [papers, visitors] = await Promise.all([papersWithArea(), visitorsWithArea()]);
  if (!papers.readable || !visitors.readable) {
    return { images: plain(images), taste: sheetTaste("unreadable", { area, papers: 0, hexes: [], colours: [] }) };
  }

  const evidence = tasteOfArea(papers.rows, area, paper.id);
  const styles = areaStyles(visitors.rows, area);
  evidence.visitors = styles.visitors;
  evidence.styleLabels = styles.labels;

  if (!evidence.hexes.length && !styles.keys.length) {
    return { images: plain(images), taste: sheetTaste("quality", evidence) };
  }
  // The style his area asked for moves the list first — it is the bigger visual difference — and
  // the area's colours order what is left inside each style group.
  const coloured = evidence.hexes.length ? rankByPicks(images, evidence.hexes) : plain(images);
  return { images: orderByStyle(coloured, styles.keys), taste: sheetTaste("area", evidence) };
}
