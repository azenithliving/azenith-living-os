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

/**
 * The same sentence in the digits he reads.
 *
 * A price is not summed off the screen: «25,000 - 45,000 جنيه» is read, so it is written ٢٥٬٠٠٠.
 * The conversion is deliberately letter-for-letter — a thousands comma becomes its Arabic shape and
 * nothing is re-grouped, because re-formatting would turn a phone tail into «٠١٠٬٢٣٤» and would
 * reorder a range a customer compares with his eye.
 */
export function arabicNumerals(value: unknown): string {
  return String(value ?? "")
    .replace(/(\d),(\d{3})/g, "$1\u066C$2")
    .replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
}

/**
 * The Arabic letters themselves. The block also holds its own question mark (؟), its own comma
 * (،) and its own digits (٠١٢٣٤٥٦٧٨٩) — and those end a word rather than continue one. Reading
 * them as letters is what made «بكام؟» fail its own price net while «بكام» passed.
 */
const AR_LETTER = String.raw`[\u0621-\u064A\u0671-\u06D3\u06FB-\u06FF]`;
/** The single letters Arabic glues onto the front of a word without a space: ب ا ل و ف ك. */
const AR_PREFIX = String.raw`[\u0628\u0627\u0644\u0648\u0641\u0643]`;
/** The endings Arabic glues onto the back of a word without a space. */
const AR_SUFFIX = String.raw`(?:ها|هما|هم|هن|كم|كن|نا|ين|ات|يات|تين|يه|ي|ه)`;

/**
 * Give a pattern an Arabic word shape, so it matches a word and not a piece of a longer one.
 *
 * JavaScript's `\b` knows ASCII only: `/\bأكل\b/.test("أكل")` is false, so a matcher written
 * with it never fires, and a matcher written without any boundary fires inside other words.
 * Measured on the published store 2026-10-02, «من أول ما أكلمكم لحد ما الأثاث يوصل» — a
 * customer asking how the work is done — was read as a food order because «أكلمكم» contains
 * «أكل», and the customer was told to switch on location permission.
 *
 * Because Arabic attaches its prefixes and suffixes without a space, both sides are written
 * out: a known single-letter prefix may precede the word, and a known ending may follow it.
 */
export function arabicWord(inner: string): string {
  return String.raw`(?:(?<!${AR_LETTER})|(?<=${AR_PREFIX}))(?:${inner})(?:(?=${AR_SUFFIX}(?!${AR_LETTER}))|(?![\u0621-\u064A\u0671-\u06D3\u06FB-\u06FF]))`;
}

/** Join words into one Arabic-safe alternation. Each entry keeps its own word shape. */
export function arabicAny(...words: string[]): RegExp {
  return new RegExp(words.map((word) => arabicWord(word)).join("|"), "i");
}
