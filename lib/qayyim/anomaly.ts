/**
 * P6-M3 — traffic watchdog: "did yesterday look like this shop at all?"
 *
 * Robust statistics on purpose. A daily traffic series is mostly a flat line
 * with the occasional spike, and a spike inside the window drags the mean up and
 * the spread out with it — the classic masking failure where mean/std says
 * "nothing unusual happened" about a day that was ten times the norm. So the
 * normal level is the median, the spread is the median absolute deviation, and
 * the score is the modified z (Iglewicz–Hoaglin).
 *
 * Only the recent edge is reported. A spike from two weeks ago is history, and a
 * watchdog that cries about it every morning gets muted by the person it serves.
 */
import "server-only";

import { supabaseServer } from "@/lib/dal/unified-supabase";
import { detectAnomalies } from "./stats";

export interface DayCount {
  date: string;
  count: number;
}

export interface AnomalyHit {
  date: string;
  count: number;
  /** Modified z-score: how many robust sigmas from a typical day. */
  z: number;
  /** A typical day in the window (the median), not the spike-inflated mean. */
  baseline: number;
}

const DAY_MS = 86_400_000;

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Bucket event timestamps into one count per day, whole window, zeros included.
 *
 * The zero-fill is not cosmetic: skipping empty days hides a collapse, which is
 * exactly half of what this watchdog is for.
 */
export function buildDailyCounts(
  timestamps: string[],
  opts: { days: number; endDate: Date },
): DayCount[] {
  const days = Math.max(1, Math.floor(opts.days));
  const lastDay = Date.parse(`${dateKey(opts.endDate.getTime())}T00:00:00.000Z`);
  const counts = new Map<string, number>();
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dateKey(lastDay - i * DAY_MS);
    dates.push(key);
    counts.set(key, 0);
  }
  for (const stamp of timestamps) {
    const at = Date.parse(stamp);
    if (!Number.isFinite(at)) continue;
    const key = dateKey(at);
    if (!counts.has(key)) continue;
    counts.set(key, (counts.get(key) as number) + 1);
  }
  return dates.map((date) => ({ date, count: counts.get(date) as number }));
}

/**
 * Days in the recent edge that do not look like the rest of the window.
 *
 * When the window is a flat line the MAD is zero and the robust score has no
 * scale to divide by; that is the one case where mean/std is the better tool, so
 * it is used as the fallback rather than pretending nothing was measured.
 */
export function anomalyFromCounts(
  series: DayCount[],
  opts: { k?: number; minPoints?: number; recentDays?: number } = {},
): AnomalyHit[] {
  const { k = 3, minPoints = 8, recentDays = 2 } = opts;
  if (series.length < minPoints) return [];

  const values = series.map((d) => d.count);
  const centre = median(values);
  const mad = median(values.map((v) => Math.abs(v - centre)));
  const firstReportable = series.length - Math.max(1, Math.floor(recentDays));
  const hits: AnomalyHit[] = [];

  if (mad === 0) {
    for (const a of detectAnomalies(values, { k, minPoints })) {
      if (a.index >= firstReportable) {
        hits.push({ date: series[a.index].date, count: series[a.index].count, z: a.z, baseline: centre });
      }
    }
    return hits;
  }

  series.forEach((day, index) => {
    const score = (0.6745 * (day.count - centre)) / mad;
    if (Math.abs(score) > k && index >= firstReportable) {
      hits.push({ date: day.date, count: day.count, z: score, baseline: centre });
    }
  });
  return hits;
}

export function renderAnomalyDigest(hits: AnomalyHit[]): string {
  if (!hits.length) return "مفيش شذوذ في حركة الزوار — الأيام الأخيرة ماشي زي المعتاد.";
  return hits
    .map((h) => {
      const dir = h.z > 0 ? "أعلى" : "أقل";
      return `• يوم ${h.date}: ${h.count} حدث — ${dir} من الطبيعي بـ ${Math.round(Math.abs(h.z) * 10) / 10} درجة (اليوم العادي حوالي ${h.baseline}).`;
    })
    .join("\n");
}

/** Reads at most this many telemetry rows; the window is a month of a small shop. */
const MAX_TELEMETRY_ROWS = 5_000;

export interface AnomalyScan {
  hits: AnomalyHit[];
  windowDays: number;
  totalEvents: number;
  /** null when the read succeeded. */
  error: string | null;
}

/**
 * Live scan over `visitor_telemetry`. That table carries no company column — it
 * is the whole storefront's traffic — so for one store it is read as-is, and the
 * digest says "زوار" rather than claiming a per-company number.
 */
export async function scanTrafficAnomalies(
  opts: { days?: number; k?: number } = {},
): Promise<AnomalyScan> {
  const days = opts.days ?? 28;
  if (!supabaseServer) {
    return { hits: [], windowDays: days, totalEvents: 0, error: "مفيش اتصال بقاعدة البيانات." };
  }
  const from = new Date(Date.now() - days * DAY_MS).toISOString();
  const { data, error } = await supabaseServer
    .from("visitor_telemetry")
    .select("created_at")
    .gte("created_at", from)
    .limit(MAX_TELEMETRY_ROWS);

  if (error) return { hits: [], windowDays: days, totalEvents: 0, error: error.message };

  const rows = (data || []) as Array<{ created_at: string }>;
  const series = buildDailyCounts(
    rows.map((r) => r.created_at),
    { days, endDate: new Date() },
  );
  return {
    hits: anomalyFromCounts(series, { k: opts.k }),
    windowDays: days,
    totalEvents: rows.length,
    error: null,
  };
}
