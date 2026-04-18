import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export async function resolvePrimaryCompanyId(): Promise<string> {
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
