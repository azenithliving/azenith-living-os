/**
 * emphasis.ts — the inline half of markdown, for a screen that prints text as text.
 *
 * Measured on the owner's own sales screen 2026-10-03: the employee's answer rendered as
 * «**حالة الأداة:** مهيأة وتعمل بنجاح (Configured). **النتائج:** لا توجد بيانات حاليًا
 * (**rows 0**)». The chat surface already turns links, headings and bullets into real
 * elements — it simply had no rule for emphasis, so the asterisks reached his eyes as
 * punctuation. The fix draws the emphasis, it does not delete it: on the owner's screen a
 * bold word carries information, and a screen that shows what a model chose to stress is
 * telling him the truth about the answer it got.
 *
 * Pure, so the shape of a sentence can be tested without a browser.
 */

export type EmphasisChunk = { kind: "text" | "bold" | "em" | "code"; value: string };

/**
 * A line that is a list item.
 *
 * Measured on the same screen: the employee's answer opened its lines with «* », and the chat
 * only recognised «- », so the star reached his eyes as punctuation at the edge of a sentence —
 * after the bold markers were already fixed, which is how a half-measure passed a first count.
 */
export function isBulletLine(line: string): boolean {
  return /^\s*[-*+•]\s+\S/.test(String(line ?? ""));
}

/** The line without its bullet mark; the text itself is untouched. */
export function stripBullet(line: string): string {
  return String(line ?? "").replace(/^\s*[-*+•]\s+/, "");
}
/** Paired markers, longest first, never crossing a line break. */
const PAIRED = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/;

/**
 * Split a line into plain text, bold and italic runs.
 *
 * An unpaired marker is left exactly where it is: «٣ * ٤ = ١٢» is a customer's arithmetic, not
 * a formatting mistake, and eating it would be a lie of the other kind.
 */
export function splitEmphasis(text: string): EmphasisChunk[] {
  const source = String(text ?? "");
  if (!source) return [];
  const chunks: EmphasisChunk[] = [];
  let rest = source;

  while (rest.length > 0) {
    const found = PAIRED.exec(rest);
    if (!found || found.index === undefined) {
      chunks.push({ kind: "text", value: rest });
      break;
    }
    if (found.index > 0) chunks.push({ kind: "text", value: rest.slice(0, found.index) });
    const mark = found[0];
    const strong = mark.startsWith("**") || mark.startsWith("__");
    const code = mark.startsWith("`");
    const edge = strong ? 2 : 1;
    chunks.push({ kind: code ? "code" : strong ? "bold" : "em", value: mark.slice(edge, mark.length - edge) });
    rest = rest.slice(found.index + mark.length);
  }

  return chunks;
}
