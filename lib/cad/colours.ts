/**
 * colours.ts — the colour matrix a sheet offers, and the rules around what may be stored.
 *
 * The families and their thresholds live in `lib/cad/palette.ts`, fitted to the store's own bank.
 * This file is the sheet-facing part: which colours this room can back with pictures, how many he
 * may choose, and what a refusal says in his words.
 *
 * The guard that matters: a pick is only kept when the colour is one of the swatches this room's
 * pictures actually carry. A customer who chooses a colour the bank cannot show him would walk away
 * from a preference the shop turned into a promise.
 */

import { FAMILY_ORDER, familyOf, paletteFor, type PaletteEntry, type PaletteFamily } from "./palette";

/** The paper's own limit — three is what the owner's brief asks a customer to choose. */
export const MAX_PICKS = 3;

export type ColourPick = { family: PaletteFamily; hex: string };

/** The matrix for a set of bank pictures, keyed the way the sheet paints it. */
export function matrixFor(images: Array<{ color: string | null }>): PaletteEntry[] {
  return paletteFor(images);
}

/** Are these the same choice? Used to answer without re-reading a row twice. */
export function samePicks(left: ColourPick[] | null | undefined, right: ColourPick[] | null | undefined): boolean {
  const a = (left ?? []).map((p) => `${p.family}|${p.hex}`).sort();
  const b = (right ?? []).map((p) => `${p.family}|${p.hex}`).sort();
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}

/**
 * Read what he sent against what his room can back.
 *
 * Every refusal is a sentence for the customer, in his words and his digits — never a key, never a
 * stack note about the field that failed.
 */
export function cleanPicks(
  raw: unknown,
  matrix: PaletteEntry[]
): { picks: ColourPick[]; refusal: string | null } {
  if (raw === undefined || raw === null) return { picks: [], refusal: "اختار لون واحد على الأقل من اللي قدامك." };
  if (!Array.isArray(raw)) return { picks: [], refusal: "اختار لون واحد على الأقل من اللي قدامك." };
  if (raw.length > MAX_PICKS) {
    return { picks: [], refusal: `اختار ${MAX_PICKS === 3 ? "تلاتة" : String(MAX_PICKS)} ألوان على الأكثر — عشان نعرف ذوقك بوضوح.` };
  }

  const picks: ColourPick[] = [];
  for (const entry of raw) {
    const family = (entry as any)?.family;
    const hex = String((entry as any)?.hex ?? "").trim().toLowerCase();
    if (typeof family !== "string" || !(FAMILY_ORDER as string[]).includes(family)) {
      return { picks: [], refusal: "اللون ده مش من اللي قدامك — اختار من صور مكانك." };
    }
    if (familyOf(hex) !== family) {
      return { picks: [], refusal: "اللون اللي بعتته مش مطابق للاسم اللي معاه — اختاره تاني من المصفوفة." };
    }
    if (!matrix.some((swatch) => swatch.hex.toLowerCase() === hex)) {
      return { picks: [], refusal: "اللون ده ما لقتوش في صور مكانك — اختار من اللي قدامك." };
    }
    if (!picks.some((p) => p.hex === hex)) picks.push({ family: family as PaletteFamily, hex });
  }

  return { picks, refusal: null };
}
