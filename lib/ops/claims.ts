import { CAPABILITY_LABELS } from "./palette";

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

/** The one fact the critic cannot infer from prose. */
export function deskTruthFor(desk: DeskRecord): string {
  const label = desk.tool ? CAPABILITY_LABELS[desk.tool]?.split(":")[0]?.trim() || null : null;
  const named = label ?? "مكتب من غير اسم مسجّل";
  if (!desk.tool) return "ولا مكتب اشتغل في الطلب ده";
  if (desk.ok === false) return `مكتب «${named}» حاول يشتغل وما نجحش`;
  return `المكتب اللي اشتغل فعلاً: ${named}`;
}

/**
 * Drop every sentence that claims executed work when no desk executed anything. The blast radius is
 * one sentence: the greeting, the numbers that really came from somewhere, and the question itself
 * stay where they are.
 */
export function honestDeskClaims(text: string, desk: DeskRecord): { text: string; removed: string[] } {
  const removed: string[] = [];
  if (desk.tool && desk.ok !== false) return { text, removed };

  const source = String(text ?? "");
  const lines = source.split("\n");
  const kept = lines
    .map((line, i) => {
      const parts = line.match(/[^.:!?؟]+[.:!?؟]?[ \t]*/g) ?? (line.trim() ? [line] : []);
      const alive = parts.filter((part) => {
        if (!CLAIM.test(part)) return true;
        removed.push(part.trim());
        return false;
      });
      return alive.join("").trim();
      // A line that was empty stays empty, so the paragraph rhythm survives.
    })
    .filter((line, i) => line.length > 0 || lines[i].trim().length === 0);

  if (!removed.length) return { text, removed };

  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: body ? `${body}\n\n${HONEST_LINE}` : HONEST_LINE, removed };
}
