/**
 * arabic.ts — the letters Egyptian typing and handwriting vary over, folded to one shape.
 *
 * أ إ آ become ا, ة is typed ه, ى is typed ي, and the vowel marks someone dictates with
 * are dropped. Without this «أحمد» and «احمد» are two customers, and «أطفال» does not
 * match a table keyed «اطفال» — so a child's room silently gets a dining room's pictures.
 *
 * Every class is written with escapes: a character range of combining marks, typed as
 * literals, once came out of the right-to-left renderer as U+0610-U+064B — a range over the
 * Arabic letters themselves, which deletes the word instead of its vowel marks.
 *
 * Deliberately separate from the folding inside `lib/consultant/faq-gate` and
 * `lib/ops/palette`: those also strip punctuation and the أل/و/ب prefixes, which is right
 * for matching a topic or a command and wrong for a name a person reads back off his sheet.
 */
export function foldArabic(value: string): string {
  return String(value ?? "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .toLowerCase()
    .trim();
}

/**
 * Arabic-Indic digits as Latin ones.
 *
 * Every number this owner reads is written ٠١٢٣٤٥٦٧٨٩, including the one he types into a
 * search box and the one a customer dictates into his sheet. A rule that strips
 * non-digits (`\D`) keeps Arabic-Indic digits as they are and then fails to match a
 * database that stores `0100…` — so the fold happens before any comparison, in one place.
 */
export function latinDigits(value: unknown): string {
  return String(value ?? "").replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}
