import "server-only";
/**
 * Which company owns the store's data?
 *
 * Answered from the database first: `p6_store_company` holds the one decision
 * made by 20260925_p6_one_store.sql. Choosing "the oldest companies row" is not
 * an identity test — `companies` contains more than one row for this business
 * with the same name and the same created_at, so the winner used to be row
 * order, and readers silently disagreed with each other.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { storeCompanyId } from "@/lib/company-scope";

/** Last-resort stamp when nothing is configured and the DB is unreachable. */
export const DEFAULT_COMPANY_ID = process.env.ADMIN_COMPANY_ID?.trim() || "";

export async function resolvePrimaryCompanyId(): Promise<string> {
  const decided = await storeCompanyId();
  if (decided) return decided;

  const configured = process.env.ADMIN_COMPANY_ID?.trim();
  if (configured) return configured;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return DEFAULT_COMPANY_ID;

  try {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();

    return data?.id || DEFAULT_COMPANY_ID;
  } catch {
    return DEFAULT_COMPANY_ID;
  }
}
