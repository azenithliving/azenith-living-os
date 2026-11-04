import "server-only";

import { arabicNote } from "@/lib/ops/alerts";
import { arNum } from "@/lib/ops/metricLabels";
import type { ConstitutionViolation } from "./ConstitutionEngine";

/**
 * The sentence that says what the quality gate refused.
 *
 * Measured 2026-11-04 in the store's own ledger: 19 rows of `quality_gate_failed`, every one of them
 * carrying an empty violation list, because the caller built its list by filtering result objects on
 * an `enforcement` field a result does not have. The strip could only print «بوابة الجودة رفضت عملاً»
 * with nothing behind it, so a refusal could not be answered.
 *
 * The note now comes from the same array the refusal was decided from, and a refusal with no name is
 * said as a contradiction rather than as a blank.
 */
export function gateBlockingNote(violations: ConstitutionViolation[]): string {
  if (!Array.isArray(violations) || violations.length === 0) {
    return "البوابة رفضت من غير ما تسمّي سبب — في تناقض في الفحص";
  }

  const names = [...new Set(violations.map((v) => v.ruleName).filter(Boolean))];
  const first = violations[0];
  const detail = first?.message ? ` · ${first.message}` : "";
  const body = `${arNum(violations.length)} سبب يمنع النشر: ${names.slice(0, 2).join(" و")}${detail}`;

  // The strip's own boundary decides what is printable; the count is never lost to a silent drop.
  const note = arabicNote(body);
  if (note) return note;
  return `${arNum(violations.length)} سبب يمنع النشر`;
}
