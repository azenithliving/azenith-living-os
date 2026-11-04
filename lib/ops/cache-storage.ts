import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Does the semantic cache tier have anywhere to put anything?
 *
 * Measured 2026-11-04 against the live record: the relation `semantic_cache` does not exist (the
 * record answers PGRST205), the function `record_cache_hit` does not exist either, and none of the
 * four Upstash credentials the Redis layers ask for is set. Six files still read or write that
 * table on real paths — the customer consultant, the admin prime and arsenal doors, the crawler and
 * the learning doors — so every one of those calls pays a refused round trip, swallows the refusal
 * in a catch, and leaves the counters reading as an empty cache when the truth is no cache.
 *
 * One probe per instance answers the question once, and every writer and reader obeys it.
 */
export type CacheTableState = "present" | "absent" | "unknown";

export type CacheStorageVerdict = {
  table: CacheTableState;
  /** How many of the two Redis layers this deployment actually configured. */
  redisLayers: number;
  /** What the verdict was built on, in words the owner can read. */
  reason: string;
};

const MISSING_TABLE = "PGRST205";

let probe: Promise<CacheStorageVerdict> | null = null;

function configuredLayers(): number {
  const pair = (prefix: string) =>
    process.env[`${prefix}_URL`] && process.env[`${prefix}_TOKEN`] ? 1 : 0;
  return pair("UPSTASH_REDIS_L1") + pair("UPSTASH_REDIS_L2");
}

async function askTheRecord(): Promise<CacheStorageVerdict> {
  const redisLayers = configuredLayers();
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { table: "unknown", redisLayers, reason: "مخزن المتجر مش متصل، فالطبقة ما اتقراش" };
  }

  const { error } = await supabase.from("semantic_cache").select("id").limit(1);
  if (!error) {
    return { table: "present", redisLayers, reason: "السجل بيجاوب على الجدول" };
  }
  if (error.code === MISSING_TABLE) {
    return {
      table: "absent",
      redisLayers,
      reason: "السجل بيرفض: ما فيش جدول بأسم السجل المخزن",
    };
  }
  return {
    table: "unknown",
    redisLayers,
    reason: `السجل رد برفض تاني (${error.code ?? "بدون رقم"}): ${error.message}`,
  };
}

/** The verdict is measured once per instance and every caller obeys the same answer. */
export function cacheStorageVerdict(): Promise<CacheStorageVerdict> {
  if (!probe) probe = askTheRecord();
  return probe;
}

/** True only when the tier may be used — an unknown verdict never claims storage it did not measure. */
export async function cacheTierIsUsable(): Promise<boolean> {
  const verdict = await cacheStorageVerdict();
  return verdict.table === "present" || verdict.redisLayers > 0;
}

/** Test seam: forget the measured verdict so the next caller probes again. */
export function resetCacheStorageProbe(): void {
  probe = null;
}
