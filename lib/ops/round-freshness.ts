import "server-only";
/**
 * هل الجولة اليومية عملت فعلًا؟
 *
 * Vercel registers the schedule and the CLI can fire it on demand, but the
 * scheduled 07:00 UTC invocation produced no row on any day — so "the cron is
 * configured" is not the same as "the round ran". This module answers the
 * question the swarm should never have to guess: when did the last real daily
 * round land, and is it overdue? The world-model digest prints the answer and
 * the commander's turn uses it as a backstop trigger.
 */
import { supabaseServer } from "@/lib/dal/unified-supabase";

/** Treat a round older than this as overdue (schedule is daily, +4h grace). */
export const ROUND_STALE_MS = 28 * 3600 * 1000;

export interface RoundFreshness {
  lastAt: string | null;
  ageHours: number | null;
  overdue: boolean;
  /** true when the row could not be read — never report that as "fresh". */
  unreadable: boolean;
}

export function freshnessFrom(lastAt: string | null, now: Date = new Date(), unreadable = false): RoundFreshness {
  if (unreadable) return { lastAt: null, ageHours: null, overdue: true, unreadable: true };
  if (!lastAt) return { lastAt: null, ageHours: null, overdue: true, unreadable: false };
  const t = new Date(lastAt).getTime();
  if (!Number.isFinite(t)) return { lastAt, ageHours: null, overdue: true, unreadable: false };
  const ageHours = Math.max(0, Math.round(((now.getTime() - t) / 3600e3) * 10) / 10);
  return { lastAt, ageHours, overdue: ageHours * 3600e3 > ROUND_STALE_MS, unreadable: false };
}

export function describeFreshness(f: RoundFreshness): string {
  if (f.unreadable) return "آخر جولة يومية: غير معروف (لم أستطع قراءة سجل الأحداث)";
  if (!f.lastAt) return "آخر جولة يومية: لم تعمل أبدًا";
  const age = f.ageHours === null ? "وقت غير معروف" : f.ageHours < 1 ? "من دقائق" : `قبل ${f.ageHours} ساعة`;
  return `آخر جولة يومية: ${age}${f.overdue ? " — متأخرة، المجدول لم يشتغل" : ""}`;
}

/**
 * Reads the newest `context_update` whose payload says daily_round. The payload
 * filter is done in JS on a small page instead of betting on PostgREST json-path
 * syntax surviving every proxy.
 */
export async function roundFreshness(companyId: string | null): Promise<RoundFreshness> {
  if (!supabaseServer || !companyId) return freshnessFrom(null, new Date(), true);
  try {
    const { data, error } = await supabaseServer
      .from("qayyim_sync_events")
      .select("created_at,payload")
      .eq("company_id", companyId)
      .eq("event_type", "context_update")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) return freshnessFrom(null, new Date(), true);
    const hit = (data || []).find((r: any) => r?.payload?.kind === "daily_round");
    return freshnessFrom((hit?.created_at as string) ?? null);
  } catch {
    return freshnessFrom(null, new Date(), true);
  }
}
