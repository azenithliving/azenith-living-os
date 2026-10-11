/**
 * sentinel-report.ts — what the watcher's reading is allowed to claim.
 *
 * The watcher used to answer «سليم» off whatever its alerts happened to be, and on this host those
 * alerts lived in a Map that started empty in every request, so the reading was always «سليم» with a
 * zero that had no source. Three states are now kept apart and each one is said out loud: the log
 * answered with rows, the log answered and held nothing, or the log did not answer at all. A zero
 * that came from a failed read is not a clean bill of health, and printing it as one is the sentence
 * an owner cannot act on.
 *
 * Pure: no database client, no model, no clock it does not receive. That is what lets the guards
 * below test the claims themselves instead of testing the plumbing around them.
 */

import { arabicNumerals } from "@/lib/arabic";

export type SystemHealthStatus = "healthy" | "degraded" | "critical";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "pending" | "applying" | "resolved" | "dismissed";
export type AlertCategory = "api" | "database" | "cache" | "memory" | "external";

/** Whether the log answered, and what it said when it did. */
export type LogState = "recorded" | "empty" | "unreadable";

export interface SystemAlert {
  id: string;
  /** When the watcher first saw this condition. */
  timestamp: string;
  /** The most recent sighting of the same condition. */
  lastSeenAt?: string;
  /** How many readings saw it while it stayed undecided. */
  occurrences?: number;
  severity: AlertSeverity;
  category: AlertCategory;
  /** The category in the words he reads; the machine key never reaches his screen. */
  categoryAr?: string;
  problem: string;
  rootCause: string;
  proposedFix: string;
  autoFixable: boolean;
  status: AlertStatus;
  appliedAt?: string;
  resolvedAt?: string;
  errorLog?: string;
}

export interface HealthSnapshot {
  status: SystemHealthStatus;
  lastCheck: string;
  logState: LogState;
  /** One Arabic sentence that says what this reading is and is not. */
  logNote: string;
  alerts: SystemAlert[];
  metrics: {
    /**
     * There is no record of provider calls behind this number, so it is `null` and the card says so.
     * Measured 2026-10-11: the table that would hold them (`api_usage_log`) has zero rows, and the
     * old value was the alert log's own shape turned into a percentage — a ratio of the thing being
     * measured, which reported 100% while the log was empty by construction.
     */
    apiSuccessRate: number | null;
    dbConnectionHealth: boolean;
    cacheHitRate: number | null;
    memoryUsagePercent: number;
    activeAlerts: number;
    criticalAlerts: number;
    /** Every row the log holds, decided or not. `null` when the log did not answer. */
    totalLogged: number | null;
  };
  recommendations: string[];
}

export type LogReading = {
  readable: boolean;
  totalLogged: number | null;
  pendingCritical: number;
  pendingWarning: number;
  pendingTotal: number;
  dbReachable: boolean;
  /** Newest sighting among the logged rows, or `null` when the log holds nothing. */
  newestSeenAt: string | null;
  /** Conditions the owner reviewed and asked to keep quiet; each one is still a real fault. */
  mutedCount: number;
  newestMuteUntil: string | null;
};

/**
 * How long a reviewed alert stays out of the waiting list. The owner named the length on 2026-10-11
 * when asked whether a dismissed fault should return on the next reading or keep quiet: a day.
 */
export const MUTE_WINDOW_HOURS = 24;

export function muteUntilFrom(now: Date): string {
  return new Date(now.getTime() + MUTE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
}

/** A mute covers a condition only while its own clock has not run out. */
export function muteIsLive(mutedUntil: string | null | undefined, now: Date): boolean {
  if (!mutedUntil) return false;
  const until = new Date(mutedUntil).getTime();
  return Number.isFinite(until) && until > now.getTime();
}

const CATEGORY_AR: Record<AlertCategory, string> = {
  api: "واجهات المزوّدين",
  database: "القاعدة",
  cache: "المخزن المؤقت",
  memory: "الذاكرة",
  external: "خدمة خارجية",
};

export function alertCategoryAr(category: AlertCategory): string {
  return CATEGORY_AR[category] ?? "حالة عامة";
}

export function logStateFor(reading: LogReading): LogState {
  if (!reading.readable) return "unreadable";
  return (reading.totalLogged ?? 0) > 0 ? "recorded" : "empty";
}

/**
 * A log that did not answer is never reported as «سليم», and a store that refused the connection is
 * never reported as anything softer than حرجة.
 */
export function healthStatusFor(reading: LogReading): SystemHealthStatus {
  if (!reading.dbReachable || reading.pendingCritical > 0) return "critical";
  if (!reading.readable || reading.pendingWarning > 2) return "degraded";
  return "healthy";
}

function arabicDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ar-EG");
}

/** A mute is a deadline, so it is read with its hour, not just its day. */
function arabicDeadline(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ar-EG");
}

function mutedClause(reading: LogReading): string {
  if (reading.mutedCount <= 0) return "";
  const count = arabicNumerals(String(reading.mutedCount));
  const until = arabicDeadline(reading.newestMuteUntil);
  return until
    ? ` و${count} تنبيه مكتوم لحد ${until} — لو السبب رجع بعدها بيتسجّل من جديد.`
    : ` و${count} تنبيه مكتوم بعد مراجعته.`;
}

export function logNoteFor(state: LogState, reading: LogReading): string {
  if (state === "unreadable") {
    return "سجل التنبيهات ما قرئتش — أي صفر في الصفحة دي مش شهادة سلامة.";
  }
  const muted = mutedClause(reading);
  if (state === "empty") {
    return `سجل التنبيهات فاضي من أول الطلب — مفيش قراءة اتسجّلت، وده مش معناه إن المتجر سليمة.${muted}`;
  }
  const seen = arabicDate(reading.newestSeenAt);
  if (reading.pendingTotal > 0) {
    const count = arabicNumerals(String(reading.pendingTotal));
    return seen
      ? `في ${count} تنبيه مستني قرار — آخر تسجيل منهم في ${seen}.${muted}`
      : `في ${count} تنبيه مستني قرار.${muted}`;
  }
  const total = arabicNumerals(String(reading.totalLogged ?? 0));
  return seen
    ? `مفيش تنبيه مستني قرار — السجل فيه ${total} قراءة، آخرها في ${seen}.${muted}`
    : `مفيش تنبيه مستني قرار — السجل فيه ${total} قراءة.${muted}`;
}

export function recommendationsFor(reading: LogReading, state: LogState): string[] {
  const out: string[] = [];
  if (!reading.dbReachable) out.push("اتصال القاعدة مش مستقر — اتأكد من حالة القاعدة");
  if (state === "unreadable") out.push("سجل التنبيهات ما قرئتش — متعتمدش على الصفر اللي في صفحته");
  if (reading.pendingCritical > 0) out.push("في تنبيهات حرجة محتاجة عين دلوقتي");
  if (reading.pendingWarning > 5) out.push("تنبيهات كتير ورا بعض — شكلها مشكلة في النظام نفسه مش في حاجة واحدة");
  if (reading.pendingWarning > 2 && reading.pendingWarning <= 5) {
    out.push(`${arabicNumerals(String(reading.pendingWarning))} تنبيهات تحذير مستنيا — بصّ عليها قبل ما تتحول لحرجة`);
  }
  return out;
}
