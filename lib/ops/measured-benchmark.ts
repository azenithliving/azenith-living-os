/**
 * The one decision that separates «I measured this» from «I have nothing».
 *
 * The benchmark ledger's score column is NOT NULL, so a writer that had no number
 * used to supply one anyway — `0` for a luxury run whose prose carried no digits,
 * `75` for a bundle run whose regex missed. Both landed as healthy-looking rows:
 * the studio card then told the owner his store scored zero while the same swarm
 * had measured 88 two hours earlier. A missing reading is now recorded as nothing.
 */
export function measuredNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The same rule applied to a whole run: a suite score is the share of the tests
 * that actually ran and were counted. A skipped test is not a failure and not a
 * pass — it is an absence, so it leaves the denominator. A run where nothing was
 * counted has no score, and the caller must record that instead of a number.
 */
export function suiteScore(
  rows: ReadonlyArray<{ status: string }> | null | undefined,
): { score: number; counted: number; passed: number } | null {
  const counted = (rows ?? []).filter((r) => r.status !== "skipped");
  if (counted.length === 0) return null;
  const passed = counted.filter((r) => r.status === "passed").length;
  return { score: Math.round((passed / counted.length) * 100), counted: counted.length, passed };
}
