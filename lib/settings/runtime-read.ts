import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The two settings the site shell renders with, read the one way the record answers.
 *
 * Measured 2026-11-04 against the live record: `site_settings` has four columns (key, value,
 * updated_at, updated_by) and no company of its own. The layout used to read `companies` first and
 * then ask this table to filter on `company_id` — a request the record answers with 400 / 42703
 * («column site_settings.company_id does not exist») — and fell back to the same unfiltered rows it
 * ends up using anyway. Three round trips per page load, one of them refused, and a tenant filter
 * that never filtered anything.
 *
 * Per-company settings would be a schema decision and a backfill, not a filter to guess at.
 */
export const RUNTIME_SETTING_KEYS = ["theme", "seo"] as const;

export type RuntimeSettings = {
  theme?: Record<string, unknown>;
  seo?: Record<string, unknown>;
};

/** A refusal is returned as nothing, and said out loud — never papered over with a second read. */
export async function loadPublicRuntimeSettings(): Promise<RuntimeSettings> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return {};

  const { data: rows, error } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", [...RUNTIME_SETTING_KEYS]);

  if (error) {
    console.error("[runtime settings] the record refused the read:", error.code, error.message);
    return {};
  }

  const out: Record<string, Record<string, unknown>> = {};
  for (const row of (rows ?? []) as unknown as Array<{ key: string | null; value: unknown }>) {
    if (row?.key && row?.value && typeof row.value === "object") {
      out[row.key] = row.value as Record<string, unknown>;
    }
  }

  return { theme: out.theme, seo: out.seo };
}
