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
