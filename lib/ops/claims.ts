import { deskLabel } from "./provenance";

/**
 * A claim that work was done is a fact, and a fact has a record.
 *
 * Measured 2026-10-07 over his 856 agent rows: 34 of them say «نفّذنا / شغّلنا / فعّلنا», and 3 carry
 * no desk record at all. One was produced live: «أضع بين يديك التقرير الاستراتيجي الفوري لعمليات
 * «عالم الدار»، بعد تفعيل الأدوات وتوزيع الأدوار على الوكلاء» — while nothing ran. The internal critic
 * passed it, because the critic only ever sees the question and the draft; it has no idea whether a
 * desk was called. So this module does two jobs: it hands the critic the one truth it is missing,
 * and it strikes the claim at the write boundary whatever the critic decides.
 *
 * What it never does: touch a sentence when a desk really ran, or mistake a plan («هنفّذ الصبح») for
 * a deed. Only past/completed execution wording counts as a claim.
 */
export type DeskRecord = { tool: string | null; ok?: boolean };

const CLAIM = /(فعّلنا|فعّلت|تفعيل الأدوات|تشغيل الأدوات|توزيع الأدوار|شغّلنا|شغلنا|قام الوكلاء|الوكلاء اللي اشتغلوا|نفّذنا|نفذنا|تم تنفيذ|تمّ تنفيذ|قمت ب|قام بتنفيذ|أُنجِز|أنجزنا)/;

const HONEST_LINE = "مفيش مكتب اتشغّل في الطلب ده — اللي فوق كلام من غير تنفيذ.";

/**
 * What a phrase list cannot catch, shape can. Live proof 2026-10-07: after the guard shipped, the
 * leader answered «وريني إنك فعلاً شغّلت كل الأدوات» with a table of agents and their states and no
 * desk record — none of its wording was in any list, but its SHAPE was a report. Anything that reads
 * like evidence (a table, or a status/finding word) is therefore disclosed as unmeasured when no
 * desk ran, whatever sentences the model chose.
 */
const REPORT_SHAPED = /(تقرير|بيان|حالة|حالات|تشغيل|فحص|أنجز|إنجاز|تنفيذ|منفّذ|نتيجة|مؤشر|إحصائ|رقم)/i;
const TABLE_ROW = /\|[^|\n]+\|[^|\n]+\|/;

export function looksLikeEvidence(text: string): boolean {
  const body = String(text ?? "");
  return TABLE_ROW.test(body) || REPORT_SHAPED.test(body);
}

/** The one fact the critic cannot infer from prose. */
export function deskTruthFor(desk: DeskRecord): string {
  const named = deskLabel(desk.tool) ?? "مكتب من غير اسم مسجّل";
  if (!desk.tool) return "ولا مكتب اشتغل في الطلب ده";
  if (desk.ok === false) return `مكتب «${named}» حاول يشتغل وما نجحش`;
  return `المكتب اللي اشتغل فعلاً: ${named}`;
}

/**
 * Drop every sentence a predicate condemns, at sentence granularity, keeping the
 * paragraph rhythm and whatever else the line carried. Owned here because two guards
 * strike sentences the same way — an execution claim and an unmeasured condition.
 *
 * A terminator ends a sentence only when a space or the end of the line follows it. Measured
 * 2026-10-09 on a live row: the first splitter cut «مبيعات بلغت 700,000 ج.م» at the dot inside
 * the currency word, so no fragment still held the money claim and the guard struck nothing
 * while reporting the condition. A decimal and a currency abbreviation are not sentence ends.
 */
export function stripSentences(
  source: string,
  condemned: (sentence: string) => boolean
): { body: string; removed: string[] } {
  const removed: string[] = [];
  const lines = source.split("\n");
  const kept = lines
    .map((line, i) => {
      const parts = line.split(/(?<=[.:!?؟])\s+/);
      const alive = parts.filter((part) => {
        if (!condemned(part)) return true;
        removed.push(part.trim());
        return false;
      });
      return alive.join(" ").trim();
      // A line that was empty stays empty, so the paragraph rhythm survives.
    })
    .filter((line, i) => line.length > 0 || lines[i].trim().length === 0);
  return { body: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), removed };
}

/**
 * Drop every sentence that claims executed work when no desk executed anything. The blast radius is
 * one sentence: the greeting, the numbers that really came from somewhere, and the question itself
 * stay where they are.
 */
export function honestDeskClaims(
  text: string,
  desk: DeskRecord
): { text: string; removed: string[]; disclosed: boolean } {
  const source = String(text ?? "");
  if (desk.tool && desk.ok !== false) return { text, removed: [], disclosed: false };

  const { body, removed } = stripSentences(source, (part) => CLAIM.test(part));
  if (!removed.length) {
    // Nothing was struck: still disclose when the answer reads like evidence without a desk.
    if (!looksLikeEvidence(source)) return { text, removed, disclosed: false };
    return { text: `${source.trim()}\n\n${HONEST_LINE}`, removed, disclosed: true };
  }
  return { text: body ? `${body}\n\n${HONEST_LINE}` : HONEST_LINE, removed, disclosed: true };
}
