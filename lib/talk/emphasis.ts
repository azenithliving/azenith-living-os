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

export type EmphasisChunk = {
  kind: "text" | "bold" | "em" | "code" | "link" | "math";
  value: string;
  href?: string;
};

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
const PAIRED = /(`[^`\n]+`|\[[^\]\n]*\]\([^)\n]*\)|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/;

/** A markdown link, and the label the model wrapped in parentheses when it had no address. */
const LINK = /^\[([^\]\n]*)\]\(([^)\n]*)\)$/;

/**
 * Split a line into plain text, bold, italic and links.
 *
 * An unpaired marker is left exactly where it is: «٣ * ٤ = ١٢» is a customer's arithmetic, not
 * a formatting mistake, and eating it would be a lie of the other kind.
 *
 * A link with no address behind it — «[(رابط غير موثق)]()», read off his cockpit 2026-10-12 — is
 * said as words. A control that goes nowhere when pressed is not a link, it is a trap.
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
      break
    }
    if (found.index > 0) chunks.push({ kind: "text", value: rest.slice(0, found.index) });
    const mark = found[0];
    const link = LINK.exec(mark);
    const strong = mark.startsWith("**") || mark.startsWith("__");
    const code = mark.startsWith("`");
    if (link) {
      const label = link[1].replace(/^\((.*)\)$/, "$1").trim();
      const address = link[2].trim();
      if (address) chunks.push({ kind: "link", value: label, href: address });
      else if (label) chunks.push({ kind: "text", value: label });
    } else {
      const edge = strong ? 2 : 1;
      chunks.push({ kind: code ? "code" : strong ? "bold" : "em", value: mark.slice(edge, mark.length - edge) });
    }
    rest = rest.slice(found.index + mark.length);
  }

  return chunks;
}

/**
 * A number-operator-number run.
 *
 * Counted on his stored rows 2026-10-12: 223 of them («٢× = ٥٤٠٠٠٠ ج.م», «٥١/١٠٠», «p95 = ٢٣٧»).
 * In a right-to-left line each number keeps its own order but the operator between two of them is
 * neutral, so the equation is displayed with its sides swapped. Nothing here rewrites a word — the
 * run is only told which way to go, which is the same thing the chat already does for an address.
 *
 * No hyphen: the measured shapes are `= × + * /`, and a date is a record, not a sum. Arabic words
 * sit outside every class here, which is what stops «٣ مقاعد + ٢ فوتيه» from becoming one run.
 */
const MATH = /(?:[A-Za-z][A-Za-z0-9_]*)?[0-9\u0660-\u0669][0-9\u0660-\u0669.,]*(?:[ \t]*[=×+*/][ \t]*[0-9\u0660-\u0669.,]*)+/g;

/** Emphasis, links and code first — and then the plain text they left between them. */
export function splitInline(text: string): EmphasisChunk[] {
  const out: EmphasisChunk[] = [];
  for (const chunk of splitEmphasis(text)) {
    if (chunk.kind !== "text") {
      out.push(chunk);
      continue;
    }
    const found = [...chunk.value.matchAll(MATH)];
    if (!found.length) {
      out.push(chunk);
      continue;
    }
    let last = 0;
    for (const run of found) {
      const at = run.index ?? 0;
      if (at > last) out.push({ kind: "text", value: chunk.value.slice(last, at) });
      out.push({ kind: "math", value: run[0] });
      last = at + run[0].length;
    }
    if (last < chunk.value.length) out.push({ kind: "text", value: chunk.value.slice(last) });
  }
  return out;
}

const BRACKET_ITEM = /\[([^\][\n]{2,40})\]/g;

/**
 * A line that is nothing but a bracketed list: «[افتح التقرير] [راجع السجل] [طبّق التحسينات]».
 *
 * Thirteen such lines in his history, all of them the employees offering next steps. The words are
 * his language and the shape is a machine's; the chat already draws a list, so the brackets become a
 * list and nothing else changes. A line that is only partly brackets, a markdown link, or a table row
 * is left exactly as it is — this rule is for the whole line, or it is guessing.
 */
export function bracketListItems(line: string): string[] | null {
  const text = String(line ?? "").trim();
  if (!text || text.includes("](") || text.includes("|")) return null;
  const items = [...text.matchAll(BRACKET_ITEM)].map((m) => String(m[1]).trim()).filter(Boolean);
  if (items.length < 2) return null;
  if (items.map((item) => `[${item}]`).join(" ") !== text.replace(/\s+/g, " ")) return null;
  return items;
}
