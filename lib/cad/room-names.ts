/**
 * room-names.ts — the store's room vocabulary, in the owner's words, off limits to Latin.
 *
 * It lives apart from the pre-call dossier because his customers' roll needs the same rule: the form
 * writes «Living Room (L-shaped sofa / ركنة)» into the lead row, and the roll printed that English
 * whole on his screen. A second namer would be the defect this project has already paid for twice —
 * one room, two Arabic names. So the sheet, the roll and the heat line all ask this module.
 *
 * It is pure and pulls in nothing that only a server may load, so a client screen can import it
 * without dragging the paper reader behind it.
 */
import { arDigits } from "@/lib/ops/metricLabels";

/**
 * Every English room spelling measured in this store's own columns, with the seven types the
 * image bank files its pictures under folded into the same names. Latin and unlisted is dropped.
 */
const ROOMS: Record<string, string> = {
  "master bedroom": "غرفة النوم الرئيسية",
  "living room": "الصالة والمعيشة",
  "dining room": "السفرة",
  "children room": "غرف الأطفال",
  "kids bedroom": "غرف الأطفال",
  "guest bedroom": "غرف الضيوف",
  "teen room": "غرف المراهقين",
  "corner sofa": "الركنة",
  lounge: "الصالة والمعيشة",
  "comprehensive interior": "المنزل بالكامل",
  "full unit": "الوحدة كاملة",
  "kitchen": "المطبخ",
  "dressing room": "غرفة الملابس",
};

/** `master-bedroom` and `Master Bedroom ` are one room to this store. */
export const keyOf = (raw: string | null | undefined) =>
  String(raw ?? "").trim().toLowerCase().replace(/[-_\s]+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();

/**
 * The shape a value has to take before it can be printed: Latin words out (the site glues them
 * on itself — «مودرن (Modern)», «(VIP - فيلا ميفيدا)»), brackets and dangling dashes out, his
 * digits in. What survives is still what the store recorded; nothing here is reworded.
 */
export const arabicShape = (text: string) =>
  text
    .replace(/[A-Za-z][A-Za-z0-9._+/-]*/g, " ")
    .replace(/[（）()]/g, " ")
    // The Latin word goes, and the slash that separated it from his word stays behind: «Living Room
    // (L-shaped sofa / ركنة)» came out as «/ ركنة», and a slash sitting between Arabic words is one
    // of the shapes his rule bans because the renderer moves the line around it.
    .replace(/\s*[/\\]\s*/g, " ")
    .replace(/\s*[-–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The one gate every value passes before it reaches his screen: Arabic in, Arabic out; a known
 * machine word in, its Arabic name out; anything else null, and no fact printed.
 */
export function arabicOnly(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/\p{Script=Arabic}/u.test(text)) return arDigits(arabicShape(text)) || null;
  return ROOMS[keyOf(text)] ?? null;
}

/** A room name — handwriting, English spelling or bank slug — said the way he reads it. */
export function roomLabel(raw: string | null | undefined): string | null {
  return ROOMS[keyOf(raw)] ?? arabicOnly(raw);
}
