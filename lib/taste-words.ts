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
  (all, [key, label]) => ({ ...all, [key]: [label] }),
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
