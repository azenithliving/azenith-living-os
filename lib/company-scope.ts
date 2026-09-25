import "server-only";

/**
 * «المحل الواحد» — store scoping.
 *
 * The shop is one business, but its rows were written across build history with
 * more than one value in the hidden `company_id` column:
 *
 *  • …-0001  ← the value the PUBLIC site reads with. `resolvePrimaryCompanyId()`
 *              picks "oldest companies row", and `companies` holds two rows with
 *              the same name and the same created_at, so which one wins is row
 *              order, not identity. The 15 live room sections and 18 user
 *              accounts sit here.
 *  • …0000   • a leftover id with no `companies` row at all.
 *  • NULL    • rows written before anyone stamped them.
 *  • ADMIN_COMPANY_ID (env) ← the id the swarm's own tables use.
 *
 * Until the data is consolidated, a read that filters by one id silently
 * describes half the shop as empty — that is where «فحصت 0 غرفة» came from.
 * `belongsToStore` is the single place that answers "is this row ours?", so no
 * feature has to re-decide it. It is intentionally read-side only: writes keep
 * using the canonical id, and the consolidation migration is a separate,
 * deliberate step.
 */

const ZERO_ONE = "00000000-0000-0000-0000-000000000001";
const ZERO_ZERO = "00000000-0000-0000-0000-000000000000";

/** Legacy stamps that belong to the same store as the canonical id. */
export const LEGACY_STORE_COMPANY_IDS: string[] = [ZERO_ONE, ZERO_ZERO];

export function storeCompanyIds(canonical: string | null): string[] {
  const ids = new Set<string>();
  if (canonical) ids.add(canonical);
  for (const legacy of LEGACY_STORE_COMPANY_IDS) ids.add(legacy);
  return [...ids];
}

/**
 * Does this row belong to the store?
 * With no canonical id we do not filter at all (the caller asked for everything),
 * and unstamped historical rows count as ours — excluding them would hide real
 * content, which is the exact bug this file exists to stop.
 */
export function belongsToStore(rowCompanyId: string | null | undefined, canonical: string | null): boolean {
  if (!canonical) return true;
  if (!rowCompanyId) return true;
  return storeCompanyIds(canonical).includes(rowCompanyId);
}

/** The same answer expressed for PostgREST: an `.in()` list, or no filter. */
export function storeIdFilter(canonical: string | null): string[] | null {
  return canonical ? storeCompanyIds(canonical) : null;
}
