import { linkFromPhone } from "./sketch-link";
import { areaLabel } from "@/lib/regions";

/**
 * The contact moment: the customer has just been shown that the store can send him three
 * real furnishing suggestions for his room, and he wants them on his own phone. That wish —
 * not a form at the end of a session — is where the store asks for his number and his area,
 * because both are what makes the delivery real.
 *
 * This module decides what a claim may write and what it must refuse, in words the customer
 * reads. It holds no database handle on purpose: the door that writes is thin, and every
 * judgement here is measurable in a test.
 */
export type ClaimInput = { phone?: unknown; city?: unknown; room?: unknown };

export type PaperFacts = {
  customer_key: string | null;
  customer_city?: string | null;
  room?: string | null;
};

export type Claim = {
  /** Arabic refusal, shown instead of writing anything. */
  refusal: string | null;
  /** What the row should be updated with; empty when nothing new was learned. */
  write: { customer_key?: string; customer_city?: string; room?: string };
  /** The room the suggestions will be drawn for — the paper's own, or the one he just named. */
  roomFor: string | null;
};

/** His area as one line of his own words: trimmed, capped. No list is forced on him. */
export function cleanCity(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function planClaim(input: ClaimInput, paper: PaperFacts): Claim {
  const phone = linkFromPhone(input.phone);
  // A paper that already holds his number does not need it again: adding the area later is
  // not a new claim, and refusing him there would be the shop arguing with its own record.
  if (!phone && !paper.customer_key) {
    return { refusal: "الرقم ده مش موبايل مصري. سيبه فاضي لو مش عايز تسيب رقم.", write: {}, roomFor: paper.room ?? null };
  }

  const city = areaLabel(cleanCity(input.city));
  const room = cleanCity(input.room);
  const write: Claim["write"] = {};

  // His digits are the strongest link there is, and the owner's link is never overwritten:
  // a second phone must not steal a paper someone else already claimed.
  if (phone && !paper.customer_key) write.customer_key = phone.key;
  // Written in the map's spelling when his words reach it, so «زايد» and «الشيخ زايد» are one area
  // and not two silos that no ranking can add up.
  if (city && !paper.customer_city) write.customer_city = city;
  if (room && !paper.room) write.room = room;

  return { refusal: null, write, roomFor: paper.room || room || null };
}

/**
 * What the sheet may promise. The bank holds pictures by room type, not by furniture
 * dimensions, so the copy says «for a room like yours» and never «cut to your measurements».
 */
export function offerLine(picked: number, matched: boolean): string {
  if (picked === 0) return "البنك ما جاوبش دلوقتي — كلّمنا ونجهزها لك بنفسنا";
  if (!matched) return `${["واحدة", "اتنين", "تلاتة"][Math.min(picked, 3) - 1] ?? picked} اقتراحات من بيت كامل، لسع ما عرفناش نوع غرفتك`;
  return `${["واحدة", "اتنين", "تلاتة"][Math.min(picked, 3) - 1] ?? picked} اقتراحات لغرفة زي غرفتك`;
}
