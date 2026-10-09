/**
 * taste-words.ts — his words for a room and a style, answered in the shapes the bank keys on.
 *
 * Measured 2026-10-08: 21 visitor rows carry a room type and a style, and one carries an area, but
 * no row carries both — so the region station had nothing to rank on from conversations. The reason
 * is not missing data alone: the same column holds «نيوكلاسيك» next to the page slug «elite-brief»,
 * and a picture bank filed `modern` / `classic` / `scandinavian` / `industrial` cannot be compared
 * with either. This module is the one place that turns a taste into the bank's own key, from the
 * store's existing vocabulary rather than a new one.
 *
 * The brake: only his sentences are read, never the store's. And a word that matches nothing is
 * answered with null — an invented style would move pictures on a taste nobody asked for.
 */
import { foldArabic } from "@/lib/arabic";
import { roomTypeFor } from "@/lib/cad/sheet-images";
import { STYLE_LABELS } from "@/lib/constants/rooms";

/**
 * The bank's four style keys, and the ways this store's own Arabic names them. Derived from
 * `STYLE_LABELS` (the catalogue's style names) so the two vocabularies cannot drift apart; the
 * extra spellings are forms customers and the qualification form really write.
 */
const STYLE_WORDS: Record<string, string[]> = Object.entries(STYLE_LABELS).reduce(
  // The key itself belongs in the list: this is the shape the store writes when it records a
  // taste, so the reader must recognise its own handwriting — «modern» folded is «modern».
  (all, [key, label]) => ({ ...all, [key]: [label, key] }),
  {} as Record<string, string[]>,
);
for (const [key, extra] of [
  ["modern", ["موديرن", "المودرن"]],
  ["classic", ["كلاسيكي", "نيوكلاسيك", "نيو كلاسيك"]],
  ["scandinavian", ["اسكندنافي", "سكاندينافية", "اسكندنافية", "نورديك"]],
  ["industrial", ["اندامستريال", "لوفت"]],
] as [string, string[]][]) {
  STYLE_WORDS[key] = [...new Set([...(STYLE_WORDS[key] ?? []), ...extra])];
}

const STYLE_MATCHERS: [string, RegExp][] = Object.entries(STYLE_WORDS).map(([key, words]) => [
  key,
  new RegExp(words.map((word) => foldArabic(word)).filter(Boolean).join("|"), "i"),
]);

/**
 * The bank's style key for a taste written in any of its shapes, or null.
 *
 * A Latin gloss inside the stored value — «مودرن (Modern)» — folds away with the brackets, so the
 * Arabic word alone decides. `elite-brief` is a page name that landed in this column and matches
 * nothing here on purpose: a screen slug is not a taste.
 */
export function styleKey(raw: unknown): string | null {
  const text = foldArabic(String(raw ?? "")).replace(/\([^)]*\)/g, " ").trim();
  if (!text) return null;
  for (const [key, matcher] of STYLE_MATCHERS) if (matcher.test(text)) return key;
  return null;
}

/**
 * The words this store writes itself when a field was left blank. Measured 2026-10-09 on the live
 * store: the brief's door sends «غير محدد» for a taste nobody chose, and «أخرى» when he picked the
 * custom box and typed nothing in it. Neither is a taste, and a reader cannot tell them from his
 * words by looking — so the writer drops them instead of filing them.
 */
const BLANK_WORDS = ["غير محدد", "أخرى", "other", "none", "-", "—"].map((word) => foldArabic(word));

/**
 * What the taste column may hold, or null when the answer is not a taste at all.
 *
 * Measured 2026-10-09: 14 of 27 visitor rows read «elite-brief» in this column — the name of the
 * screen that asked, written by a page that had nothing to report because the schema refused an
 * empty answer. A page name is not a taste, and neither is the store's own word for blank. His
 * own words («هادئ فاخر») stay exactly as he wrote them even when no picture matches them: the
 * sheet already says out loud when it cannot read a taste.
 *
 * The shape rule catches what the door's own page name cannot: this route files every elite screen
 * under one address, so a second form writing its own slug would slip past a comparison alone.
 */
export function storedTaste(raw: unknown, pageName?: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  // A path, in either shape, is a screen and not a style.
  if (text.startsWith("/")) return null;
  const folded = foldArabic(text.toLowerCase());
  const page = foldArabic(String(pageName ?? "").trim().replace(/^\//, "").toLowerCase());
  if (page && folded === page) return null;
  if (BLANK_WORDS.includes(folded)) return null;
  // A latin word joined by dashes or underscores is how this codebase names things, not how he
  // describes a room — unless the taste reader knows the word behind it.
  if (/^[a-z0-9]+([-_][a-z0-9]+)+$/.test(folded) && !styleKey(folded)) return null;
  return text;
}

/**
 * The taste tally a chart should show.
 *
 * Measured 2026-10-09 on the live store: the analytics door grouped the taste column verbatim, so
 * its biggest "style" was «elite-brief» (14 rows — a screen name), and one taste written three ways
 * («مودرن», «مودرن (Modern)», «modern») took three places in a top-five list. Eight groups out of
 * 30 rows, where the store's own reader sees three.
 *
 * So the tally asks the same two questions every other surface asks: is this an answer at all
 * (`storedTaste`), and what does the bank call it (`styleKey`). His own words that no picture
 * matches are counted together and named as what they are, and anything that is not a taste is
 * left out — with the count of what was left out, because a chart that silently drops rows is how
 * a number starts being disbelieved.
 */
export function tallyTastes(rows: { style: unknown }[]): { groups: { style: string; count: number }[]; skipped: number } {
  const counts = new Map<string, number>();
  let skipped = 0;
  for (const row of rows) {
    const kept = storedTaste(row.style);
    if (!kept) {
      skipped += 1;
      continue;
    }
    const key = styleKey(kept);
    const label = key ? (STYLE_LABELS[key] ?? key) : "ذوقه بكلماته";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const groups = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"))
    .map(([style, count]) => ({ style, count }));
  return { groups, skipped };
}

/** The style he asked for, his newest sentence winning. */
export function styleFromWords(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const key = styleKey(lines[i] ?? "");
    if (key) return key;
  }
  return null;
}

/** The room he asked for, in the bank's own type key — the room vocabulary the sheet already uses. */
export function roomFromWords(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const type = roomTypeFor(lines[i] ?? "");
    if (type) return type;
  }
  return null;
}
