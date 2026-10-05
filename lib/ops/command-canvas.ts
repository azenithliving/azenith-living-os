import { arDigits, arNum } from "./metricLabels";

/**
 * The four numbers the owner checks before he reads anything, and the one rule that keeps
 * them honest: a source that has not answered is named in words, never shown as a zero.
 *
 * This is a pure module because two screens draw the same bar — the owner's overview
 * address and the swarm address — and a second copy of this rule is a second counter of
 * the same truth, which is how two screens start disagreeing.
 */
export type PulseSources = {
  customers: number | null;
  needingReply: number | null;
  decisions: number | null;
  /** Read state has not arrived yet, so the count is unknown rather than empty. */
  unread: number | null;
  loaded: boolean;
};

export type PulseItem = {
  label: string;
  /** null when the door behind the number has not answered. */
  value: number | null;
  /** What the owner reads: an Arabic-Indic count, or the written line. */
  text: string;
};

export const PULSE_LABELS = [
  "العملاء في الدفتر",
  "مستنيين رد",
  "قرارات مستنية كلمتك",
  "رسائل جديدة من الموظفين",
] as const;

/** The words shown in place of a number that does not exist yet. */
export const WAITING_TEXT = "بستنى الرد";

export function pulseItems(sources: PulseSources): PulseItem[] {
  const unread = sources.loaded ? sources.unread : null;
  const raw: Array<{ label: string; value: number | null }> = [
    { label: PULSE_LABELS[0], value: sources.customers },
    { label: PULSE_LABELS[1], value: sources.needingReply },
    { label: PULSE_LABELS[2], value: sources.decisions },
    { label: PULSE_LABELS[3], value: unread },
  ];
  return raw.map((item) => ({ ...item, text: item.value === null ? WAITING_TEXT : arNum(item.value) }));
}

/**
 * One readable line out of an agent reply, for the card under his name.
 *
 * Table rows are dropped rather than flattened: the card is a sentence, and flattening a
 * table is what produced «فحصت 0 غرفة و1 منتج. | المشكلة | الرابط | ماذا أفعل؟ | | —» on
 * a phone screen.
 *
 * A line with no Arabic in it is dropped too, and a Latin run inside a kept line is cut out.
 * Measured on the live store before this rule existed, the newest agent line in 10 of 10
 * conversations carried Latin letters — the models open their reports with their own English
 * headings («SEO Audit Results», «Quality Assurance Learnings») and put the sentence he can act
 * on further down, so every card read as machine prose to a man who reads Arabic. Numbers become
 * his numerals: `arDigits` rather than `arNum`, because a number read in a sentence must not grow
 * a thousands separator.
 */
export function previewLine(content: string): string {
  const prose = String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes("|") && !line.startsWith("#") && /\p{Script=Arabic}/u.test(line))
    .join(" ");
  if (!prose) return "";
  const clean = prose
    .replace(/[*`>_]/g, "")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\S*:\/\/\S+/g, " ")
    .replace(/[A-Za-z][A-Za-z0-9_.+-]*/g, " ")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\p{Script=Arabic}/u.test(clean)) return "";
  const arabic = arDigits(clean);
  if (arabic.length <= 130) return arabic;

  // A cut that lands inside a bracket leaves the card ending on an opened clause, so the line
  // gives back the clause rather than showing him a sentence with a hole in it.
  let head = arabic.slice(0, 127).trimEnd();
  const unopened = (head.match(/\(/g)?.length ?? 0) - (head.match(/\)/g)?.length ?? 0);
  for (let cut = 0; cut < unopened; cut += 1) {
    const at = head.lastIndexOf("(");
    if (at < 0) break;
    head = head.slice(0, at).trimEnd();
  }
  return `${head.replace(/[ +\-،:؛(]+$/, "").trimEnd()}…`;
}
