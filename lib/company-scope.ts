import "server-only";
/**
 * «المحل الواحد» — store scoping.
 *
 * History this file exists because of: the shop is one business, but build
 * history wrote its rows under three different `company_id` values (one of them
 * a id with no `companies` row at all) plus a batch of unstamped rows. Any read
 * filtering by a single value therefore described part of the store as empty —
 * that is where «فحصت 0 غرفة» came from, and `resolvePrimaryCompanyId()`'s
 * "oldest companies row" could not settle it, because `companies` holds two rows
 * with the same name and the same created_at.
 *
 * State since 2026-09-25: `supabase/migrations/20260925_p6_one_store.sql`
 * consolidated every row onto the single id recorded in `p6_store_company`, and
 * a BEFORE trigger normalises any row arriving without it. So the database, not
 * this file, is now the guarantee. What remains here is the read-side seam:
 *  • `storeCompanyId()` — the one place that asks "which stamp is the store's?"
 *    instead of each feature re-deciding it.
 *  • `belongsToStore()` — still tolerant of unstamped rows, which is cheap
 *    insurance for an environment that has not run the migration yet.
 */
import { supabaseServer } from "@/lib/dal/unified-supabase";

/**
 * Retired stamps that should still be treated as ours on read. Deliberately
 * empty after the consolidation; kept as the seam so a future environment that
 * is found to hold legacy stamps is healed here once, rather than every feature
 * inventing its own workaround.
 */
export const LEGACY_STORE_COMPANY_IDS: string[] = [];

export function storeCompanyIds(canonical: string | null): string[] {
  const ids = new Set<string>();
  if (canonical) ids.add(canonical);
  for (const legacy of LEGACY_STORE_COMPANY_IDS) ids.add(legacy);
  return [...ids];
}

let decidedCache: string | null | undefined;

/**
 * The store's owner stamp as recorded in the database by the P6 migration.
 * `companies` holds more than one row for this business, and they share a name
 * and a created_at — so "the oldest row" is not an identity, it is a coin
 * toss. This table is the single written decision.
 */
export async function storeCompanyId(): Promise<string | null> {
  if (decidedCache !== undefined) return decidedCache;
  if (!supabaseServer) return (decidedCache = null);
  try {
    const { data } = await supabaseServer.from("p6_store_company").select("company_id").limit(1).maybeSingle();
    decidedCache = (data?.company_id as string) ?? null;
  } catch {
    decidedCache = null; // table not migrated yet — callers fall back
  }
  return decidedCache;
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
