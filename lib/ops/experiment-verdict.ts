/**
 * What an A/B number means to the owner, in words he can act on.
 *
 * Split from `ab-testing.ts` deliberately: reading the events table is not
 * interesting, and the sentence is the part that has to be right. «مش حاسم بعد»
 * on its own is a shrug — with «محتاج ~N زائر لكل ناحية» it becomes a plan he can
 * either fund with traffic or drop.
 *
 * Pure: numbers in, Arabic out. All arithmetic comes from `stats.ts`.
 */

import { twoProportionZTest, requiredVisitorsPerArm } from "./stats";

export interface ExperimentCounts {
  controlImpressions: number;
  controlConversions: number;
  variantImpressions: number;
  variantConversions: number;
  /** Percent, e.g. 30 = a 30% relative lift is the smallest change worth seeing. */
  minimumDetectableEffect: number;
}

export type VerdictStatus = "decisive-variant" | "decisive-control" | "inconclusive" | "no-data";

export interface ExperimentVerdict {
  status: VerdictStatus;
  text: string;
  confidence: number | null;
  requiredVisitorsPerArm: number | null;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function verdictForExperiment(counts: ExperimentCounts): ExperimentVerdict {
  const test = twoProportionZTest(
    counts.controlImpressions,
    counts.controlConversions,
    counts.variantImpressions,
    counts.variantConversions,
  );
  const confidence = test.p === null ? null : 1 - test.p;

  if (test.verdict !== "measured" || test.p === null || confidence === null) {
    return {
      status: "no-data",
      text: "مفيش بيانات تكفي للحكم — عدد الزوار أو التحويلات ما يسمحش بمقارنة.",
      confidence: null,
      requiredVisitorsPerArm: null,
    };
  }

  const from = pct(test.controlRate);
  const to = pct(test.treatmentRate);
  const confidenceText = `${Math.round(confidence * 1000) / 10}%`;

  if (test.significant && test.treatmentWins === true) {
    return {
      status: "decisive-variant",
      text: `الأسلوب الجديد كسب: معدل التحويل طلع من ${from} إلى ${to} (ثقة ${confidenceText}).`,
      confidence,
      requiredVisitorsPerArm: null,
    };
  }

  if (test.significant && test.treatmentWins === false) {
    return {
      status: "decisive-control",
      text: `الأقدم أفضل: الجديد نزّل التحويل من ${from} إلى ${to} (ثقة ${confidenceText}).`,
      confidence,
      requiredVisitorsPerArm: null,
    };
  }

  const lift = counts.minimumDetectableEffect > 0 ? counts.minimumDetectableEffect / 100 : 0;
  const needed = requiredVisitorsPerArm({ baselineRate: test.controlRate, relativeLift: lift });

  return {
    status: "inconclusive",
    text: needed
      ? `مش حاسم بعد — الفرق اللي قدامنا ممكن يكون حظ. محتاج حوالي ${needed} زائر لكل ناحية عشان نكتشف فرق ${counts.minimumDetectableEffect}%.`
      : "مش حاسم بعد — ومفيش أساس ثابت نقيس عليه الحجم اللي محتاجينه.",
    confidence,
    requiredVisitorsPerArm: needed,
  };
}
