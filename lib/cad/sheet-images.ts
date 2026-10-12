/**
 * sheet-images.ts — the pictures that go on a customer's design sheet.
 *
 * The bank is real and measured: 7,805 active pictures in ten room types
 * (comprehensive-interior 1805, master-bedroom 1301, living-room 918, children-room 891,
 * dining-room 781, teen-room 717, lounge 475, kitchen 460, corner-sofa 369, dressing-room 88),
 * hosted on a free image licence. The plan paper said fifteen thousand; the table says what it says,
 * and the sheet only ever shows what is really in there.
 *
 * One thing the table does not carry: `quality_score` holds 0.00 in all 7,805 rows, so ordering by it
 * answers arbitrarily. The verdict that does exist is the harvester's `metadata.ai_score`, written on
 * 3,036 rows and unevenly spread (kitchen 460 of 460, master-bedroom 23 of 1,301, living-room none) —
 * so a "best" pick here orders by that score where it exists and falls back to the bank's own harvest
 * slot, which at least gives the same picture every time.
 *
 * When the room on the drawing does not match any type the bank holds, the sheet gets
 * the general house set and says so. A guess presented as «picked for your room» is
 * the kind of tidy lie this store's owner asked to be rid of.
 */

import { foldArabic } from "@/lib/arabic";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { BANK_TYPES, GENERAL_ROOM } from "./room-labels";

export type SheetImage = { id: number | null; url: string; thumb: string; style: string | null; roomType: string; color: string | null };

/**
 * Arabic words a customer or the reader might use, folded to the type that holds
 * pictures. Unaccented and prefix-matched, because handwriting and speech both vary.
 */
const ROOM_WORDS: [string, string][] = [
  ["نوم", "master-bedroom"],
  ["ماستر", "master-bedroom"],
  ["رئيسي", "master-bedroom"],
  ["معيش", "living-room"],
  ["صالة", "living-room"],
  ["استقبال", "living-room"],
  ["مجلس", "living-room"],
  ["سفرة", "dining-room"],
  ["اطعام", "dining-room"],
  ["دايننج", "dining-room"],
  ["اطفال", "children-room"],
  ["بنت", "children-room"],
  ["بنات", "children-room"],
  ["اولاد", "children-room"],
  ["ولاد", "children-room"],
  ["مراهق", "teen-room"],
  ["تيين", "teen-room"],
  ["شاب", "teen-room"],
  ["ركن", "corner-sofa"],
  ["ركنة", "corner-sofa"],
  ["كورنر", "corner-sofa"],
];

/** Which bank type a room name points at, or null when it points at none. */
export function roomTypeFor(name: string | null | undefined): string | null {
  // The folding itself lives in `lib/arabic.ts`, next to the customer matcher: a room word
  // and a customer name vary over the same letters, and two folds drift.
  const text = foldArabic(String(name ?? ""));
  if (!text) return null;
  for (const [word, type] of ROOM_WORDS) if (text.includes(foldArabic(word))) return type;
  const exact = text.replace(/\s+/g, "-");
  return BANK_TYPES.includes(exact) ? exact : null;
}

/**
 * The bank's best pictures are not the bank's most useful three.
 *
 * Ordered by quality alone, the first three bedroom pictures measured on the live bank were
 * three heavy majlis rooms in the same style — a customer reading «اقتراحات» and getting one
 * taste three times learns nothing about what the shop can do. So the list keeps its quality
 * order and takes the best of each style before it repeats one.
 */
export function diversifyByStyle<T extends { style: string | null }>(rows: T[], limit: number): T[] {
  if (limit <= 0) return [];
  const picked: T[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.style ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(row);
    if (picked.length === limit) return picked;
  }
  for (const row of rows) {
    if (picked.length === limit) break;
    if (!picked.includes(row)) picked.push(row);
  }
  return picked;
}

/** One bank row, in the shape a sheet can show. */
function toSheetImage(row: any): SheetImage | null {
  if (typeof row?.url !== "string" || !row.url.startsWith("http")) return null;
  return {
    id: Number.isFinite(Number(row.id)) ? Number(row.id) : null,
    url: String(row.url),
    thumb: typeof row.thumbnail_url === "string" && row.thumbnail_url ? String(row.thumbnail_url) : String(row.url),
    style: row.style ? String(row.style) : null,
    roomType: String(row.room_type),
    // The bank stores the dominant colour of every picture — that is what lets the
    // dossier show the palette a room is actually made of instead of a mood word.
    color: typeof row.metadata?.avg_color === "string" ? String(row.metadata.avg_color) : null,
  };
}

/**
 * The pictures for one sheet.
 *
 * `preferredStyles` is not a filter: the customer is still shown his room's best work. It is a
 * second slice, because the bank's highest-quality window can be one style end to end — measured
 * 2026-10-08 on a sheet whose area asked for modern, where the 60 best pictures of the house set
 * were all classic. Without the extra slice, a sentence about his area's taste has nothing behind
 * it; with it, the style he was promised is a picture he can see.
 */
export async function pickSheetImages(
  roomName: string | null | undefined,
  limit = 20,
  preferredStyles: string[] = []
): Promise<{ images: SheetImage[]; roomType: string; matched: boolean }> {
  const supabase = getSupabaseAdminClient();
  const wanted = roomTypeFor(roomName);
  const roomType = wanted ?? GENERAL_ROOM;

  if (!supabase) return { images: [], roomType, matched: false };

  const slice = () =>
    supabase
      .from("curated_images")
      .select("id,url,thumbnail_url,style,room_type,metadata")
      .eq("room_type", roomType)
      .eq("is_active", true)
      .not("url", "is", null);

  const quality = await slice()
    .order("quality_score", { ascending: false, nullsFirst: false })
    // A score of zero on a row means "never judged", not "worst". Without these two tiebreaks the
    // database answers in whatever order it feels, so the same customer sees a different first
    // suggestion on reload — measured on 5 of the 10 room types before the scores were copied in.
    .order("display_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(Math.min(limit * 6, 60));

  let styled: { data?: unknown[] | null; error: unknown } = { data: [], error: null };
  if (preferredStyles.length > 0) {
    styled = await slice()
      .in("style", preferredStyles)
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(Math.min(limit * 3, 36));
    if (styled.error) console.warn("[SheetImages] الطراز المطلوب مقراش:", (styled.error as any)?.message ?? "بلا سبب");
  }

  if (quality.error || !Array.isArray(quality.data)) return { images: [], roomType, matched: false };

  const seen = new Set<string>();
  const usable = [...(styled.data ?? []), ...(quality.data ?? [])]
    .map(toSheetImage)
    .filter((image): image is SheetImage => image !== null)
    .filter((image) => {
      const key = image.id !== null ? `#${image.id}` : image.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { images: diversifyByStyle(usable, limit), roomType, matched: Boolean(wanted) };
}

/**
 * The storefront's own name for a room the bank spells differently.
 *
 * The whole-house card and the bank's general set are the same thing under two names, and this is the
 * only place that says so — the alternative is a guess inside the query, which is how a bathroom card
 * ends up wearing a house picture.
 */
const COVER_ALIASES: Record<string, string> = {
  "interior-design": GENERAL_ROOM,
};

/** Which bank type a storefront room stands on, or `null` when the bank holds no such room. */
export function bankTypeForRoom(room: string): string | null {
  return roomTypeFor(room) ?? COVER_ALIASES[room] ?? null;
}

/**
 * The picture the storefront shows for each room, under each style it offers.
 *
 * Measured 2026-10-11: the home page asked an external photo service once per room on every visit, with
 * a random page offset in the query, so the same room answered one picture to one visitor and another
 * to the next — while the bank held 7,805 active pictures of those very rooms, and all 38 of its
 * (room, style) cells loaded when probed. This asks the bank once, through one SQL call, and gets the
 * same row every time: the harvester's score where one exists, then the bank's own harvest slot.
 *
 * Only rooms the bank really holds are answered. `home-office` is named by the storefront and empty in
 * the bank, and the six rooms with no bank type at all (guest bedroom, study, bathrooms, lobby) are
 * left out rather than filled from the whole-house set — the caller keeps its named fallback for those.
 */
export async function pickRoomCovers(rooms: string[]): Promise<Record<string, Record<string, string>>> {
  const supabase = getSupabaseAdminClient();
  if (!supabase || rooms.length === 0) return {};

  const types = [...new Set(rooms.map(bankTypeForRoom).filter((type): type is string => Boolean(type)))];
  if (types.length === 0) return {};

  const { data, error } = await supabase.rpc("pick_room_covers", { p_types: types, p_style: null });
  if (error || !Array.isArray(data)) {
    console.warn("[RoomCovers] the bank did not answer:", (error as { message?: string } | null)?.message ?? "no rows returned");
    return {};
  }

  const rows = data as Array<{ out_room_type: string; out_style: string | null; out_url: string }>;
  const covers: Record<string, Record<string, string>> = {};
  for (const room of rooms) {
    const type = bankTypeForRoom(room);
    if (!type) continue;
    for (const row of rows) {
      if (row.out_room_type !== type || !row.out_style || typeof row.out_url !== "string") continue;
      covers[row.out_style] = { ...(covers[row.out_style] ?? {}), [room]: row.out_url };
    }
  }

  const cells = Object.values(covers).reduce((sum, set) => sum + Object.keys(set).length, 0);
  console.log(`[RoomCovers] asked ${rooms.length} rooms · bank answered ${cells} room-style pictures across ${Object.keys(covers).length} styles`);
  return covers;
}
