/**
 * sheet-images.ts — the pictures that go on a customer's design sheet.
 *
 * The bank is real and measured: 5,585 active images in seven room types
 * (master-bedroom 1301, living-room 918, children-room 891, dining-room 781,
 * teen-room 717, comprehensive-interior 634, corner-sofa 343), hosted on a free
 * image licence. The plan paper said fifteen thousand; the table says what it says,
 * and the sheet only ever shows what is really in there.
 *
 * When the room on the drawing does not match any type the bank holds, the sheet gets
 * the general house set and says so. A guess presented as «picked for your room» is
 * the kind of tidy lie this store's owner asked to be rid of.
 */

import { foldArabic } from "@/lib/arabic";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type SheetImage = { url: string; thumb: string; style: string | null; roomType: string };

/** The seven types the bank actually holds, in the order the sheet prefers them. */
const ROOM_TYPES = [
  "master-bedroom",
  "living-room",
  "dining-room",
  "children-room",
  "teen-room",
  "corner-sofa",
  "comprehensive-interior",
] as const;

const GENERAL_ROOM = "comprehensive-interior";

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
  return (ROOM_TYPES as readonly string[]).includes(exact) ? exact : null;
}

export async function pickSheetImages(
  roomName: string | null | undefined,
  limit = 20
): Promise<{ images: SheetImage[]; roomType: string; matched: boolean }> {
  const supabase = getSupabaseAdminClient();
  const wanted = roomTypeFor(roomName);
  const roomType = wanted ?? GENERAL_ROOM;

  if (!supabase) return { images: [], roomType, matched: false };

  const { data, error } = await supabase
    .from("curated_images")
    .select("url,thumbnail_url,style,room_type")
    .eq("room_type", roomType)
    .eq("is_active", true)
    .not("url", "is", null)
    .order("quality_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return { images: [], roomType, matched: false };

  const images = data
    .filter((row: any) => typeof row.url === "string" && row.url.startsWith("http"))
    .map((row: any) => ({
      url: String(row.url),
      thumb: typeof row.thumbnail_url === "string" && row.thumbnail_url ? String(row.thumbnail_url) : String(row.url),
      style: row.style ? String(row.style) : null,
      roomType: String(row.room_type),
    }));

  return { images, roomType, matched: Boolean(wanted) };
}
