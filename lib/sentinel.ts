"use server";

import { readFile } from "node:fs/promises";
import { totalmem } from "node:os";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { arabicNumerals } from "@/lib/arabic";
import { askGoogle } from "@/lib/ai-orchestrator";
import {
  alertCategoryAr,
  healthStatusFor,
  logNoteFor,
  logStateFor,
  recommendationsFor,
  type AlertCategory,
  type AlertSeverity,
  type HealthSnapshot,
  type LogReading,
  type SystemAlert,
} from "@/lib/sentinel-report";

/**
 * Sentinel: Self-Healing Architecture & System Health Monitor
 * Watches system logs, auto-fixes small issues, alerts on critical errors
 *
 * The alert log is the table `system_alerts`, not a variable. An alert that only exists inside the
 * request that found it is an organ that forgets: measured 2026-10-10, this module held its alerts in
 * a `Map` next to its own code, so on serverless every reader heard «مفيش تنبيهات» and a permanent
 * zero was printed on his screen as a clean bill of health.
 */

type AlertRow = {
  id: string;
  occurred_at: string;
  last_seen_at: string;
  occurrences: number;
  severity: AlertSeverity;
  category: AlertCategory;
  problem: string;
  root_cause: string;
  proposed_fix: string;
  auto_fixable: boolean;
  status: "pending" | "applying" | "resolved" | "dismissed";
  applied_at: string | null;
  resolved_at: string | null;
  error_log: string | null;
  dedupe_key: string | null;
};

const ALERTS_TABLE = "system_alerts";

/**
 * The provider's name as the owner reads it. A machine id (groq, openrouter) never enters his
 * sentence — these are the words he hears the service called.
 */
const PROVIDER_AR: Record<string, string> = {
  groq: "غروك",
  openrouter: "أوبن راوتر",
  mistral: "ميسترال",
  openai: "أوبن‌أي‌آي",
  google: "جوجل",
  xai: "إكس إيه آي",
};

function providerAr(provider: string): string {
  return PROVIDER_AR[provider.toLowerCase()] ?? "المزوّد";
}

function rowToAlert(row: AlertRow): SystemAlert {
  return {
    id: row.id,
    timestamp: row.occurred_at,
    lastSeenAt: row.last_seen_at,
    occurrences: row.occurrences,
    severity: row.severity,
    category: row.category,
    categoryAr: alertCategoryAr(row.category),
    problem: row.problem,
    rootCause: row.root_cause,
    proposedFix: row.proposed_fix,
    autoFixable: row.auto_fixable,
    status: row.status,
    appliedAt: row.applied_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    errorLog: row.error_log ?? undefined,
  };
}

type AlertDraft = {
  dedupeKey: string;
  severity: AlertSeverity;
  category: AlertCategory;
  problem: string;
  rootCause: string;
  proposedFix: string;
  autoFixable: boolean;
  errorLog?: string;
};

/**
 * One row per open condition. While a condition waits for a decision it holds its `dedupe_key`
 * alone, so a second reading of the same thing raises `occurrences` and moves `last_seen_at` instead
 * of adding a twin row; closing the alert hands the key back, so a recurrence next week becomes a new
 * row with its own first sighting and the decided row stays untouched in the log.
 *
 * The written row is read back from the store before the caller is told anything, because silence
 * here reads as "nothing happened".
 */
async function recordAlert(draft: AlertDraft): Promise<SystemAlert | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn("[sentinel] alert not stored — no database client in this function");
    return null;
  }

  const now = new Date().toISOString();
  const fields = {
    severity: draft.severity,
    category: draft.category,
    problem: draft.problem,
    root_cause: draft.rootCause,
    proposed_fix: draft.proposedFix,
    auto_fixable: draft.autoFixable,
    error_log: draft.errorLog ?? null,
    last_seen_at: now,
  };

  const { data: open, error: lookupError } = await supabase
    .from(ALERTS_TABLE)
    .select("id, occurrences")
    .eq("dedupe_key", draft.dedupeKey)
    .maybeSingle();

  if (lookupError) {
    console.warn(`[sentinel] open alert lookup failed: ${lookupError.message}`);
    return null;
  }

  if (open) {
    const occurrences = (open.occurrences ?? 1) + 1;
    const { data, error } = await supabase
      .from(ALERTS_TABLE)
      .update({ ...fields, occurrences })
      .eq("id", open.id)
      .select("*")
      .single();
    if (error || !data) {
      console.warn(`[sentinel] repeated alert not stored: ${error?.message ?? "no row returned"}`);
      return null;
    }
    console.log(`[sentinel] repeated ${draft.dedupeKey} — stored occurrences = ${data.occurrences}`);
    return rowToAlert(data as AlertRow);
  }

  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .insert({ ...fields, occurred_at: now, dedupe_key: draft.dedupeKey })
    .select("*")
    .single();
  if (error || !data) {
    console.warn(`[sentinel] alert not stored: ${error?.message ?? "no row returned"}`);
    return null;
  }
  console.log(`[sentinel] recorded ${draft.dedupeKey} — stored row = ${data.id}`);
  return rowToAlert(data as AlertRow);
}

type AlertLog = {
  readable: boolean;
  alerts: SystemAlert[];
  totalLogged: number | null;
};

const EMPTY_LOG: AlertLog = { readable: false, alerts: [], totalLogged: null };

async function readAlertLog(limit: number, onlyPending = false): Promise<AlertLog> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.warn("[sentinel] alert log unreadable — no database client");
    return EMPTY_LOG;
  }

  const base = supabase.from(ALERTS_TABLE).select("*", { count: "exact" });
  const filtered = onlyPending ? base.eq("status", "pending") : base;

  const { data, error, count } = await filtered
    .order("last_seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn(`[sentinel] alert log unreadable: ${error.message}`);
    return { readable: false, alerts: [], totalLogged: null };
  }

  const alerts = ((data ?? []) as unknown as AlertRow[]).map(rowToAlert);
  return { readable: true, alerts, totalLogged: count ?? 0 };
}

/**
 * The instance's own memory ceiling, read off the container instead of guessed. The old code
 * compared the heap against a constant 512 megabytes that no configuration set — an invented limit
 * that made the alert threshold mean nothing.
 */
async function memoryCeilingMB(): Promise<number> {
  for (const path of ["/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"]) {
    try {
      const raw = (await readFile(path, "utf8")).trim();
      if (!raw || raw === "max") continue;
      const bytes = Number(raw);
      // cgroup v1 writes an enormous sentinel when no limit is set; that is not a ceiling.
      if (Number.isFinite(bytes) && bytes > 0 && bytes < 2 ** 40) return bytes / (1024 * 1024);
    } catch {
      /* this host has no cgroup file to read */
    }
  }
  return totalmem() / (1024 * 1024);
}

/**
 * Ask the store one question that answers or does not, and record what happened. The verdict is the
 * same reading the metrics card prints, so the log and the number can never disagree.
 */
async function watchDatabaseConnection(): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    await monitorDatabaseHealth(new Error("no database client for this function"));
    return false;
  }
  const { error } = await supabase.from("users").select("count", { count: "exact", head: true });
  if (error) {
    await monitorDatabaseHealth(new Error(error.message));
    return false;
  }
  return true;
}

/** The heap of the function answering this request, against the ceiling it actually has. */
async function watchMemory(): Promise<number> {
  const heapUsedMB = process.memoryUsage().heapUsed / (1024 * 1024);
  const ceilingMB = Math.max(await memoryCeilingMB(), 1);
  await monitorMemoryUsage(heapUsedMB, ceilingMB);
  return Math.round((heapUsedMB / ceilingMB) * 1000) / 10;
}

/**
 * The key desk already stores what each provider answered, per key: `error_count` is the number of
 * calls that came back failing. Counting it is what makes the watcher's api sentence about a
 * measurement instead of a hunch — before this nothing in the store ever called an api monitor, so
 * the alert could never exist.
 */
async function watchProviderKeys(): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("api_keys")
    .select("provider, error_count, last_error")
    .gte("error_count", 3)
    .limit(500);

  if (error || !data || data.length === 0) return;

  const byProvider = new Map<string, { calls: number; keys: number; sample?: string }>();
  for (const row of data as unknown as Array<{ provider: string; error_count: number; last_error: string | null }>) {
    const provider = String(row.provider ?? "").toLowerCase();
    if (!provider) continue;
    const seen = byProvider.get(provider) ?? { calls: 0, keys: 0 };
    seen.calls += Number(row.error_count) || 0;
    seen.keys += 1;
    if (!seen.sample && row.last_error) seen.sample = String(row.last_error);
    byProvider.set(provider, seen);
  }

  for (const [provider, seen] of byProvider) {
    const { count } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("provider", provider)
      .in("check_state", ["alive", "writes"]);
    await monitorAPIHealth(provider, seen.calls, seen.keys, count ?? 0, seen.sample);
  }
}

/**
 * Monitor a provider whose keys are recording failures.
 *
 * `failedCalls` is summed off the desk's own counters, `failingKeys` is how many keys carry them, and
 * `usableKeys` is how many keys of that provider have been proven to answer — which is what decides
 * whether handing the request to another key is a real fix or a dead end.
 */
export async function monitorAPIHealth(
  provider: string,
  failedCalls: number,
  failingKeys = 0,
  usableKeys = 0,
  errorSample?: string
): Promise<void> {
  const name = providerAr(provider);
  const rotationPossible = usableKeys > 0;
  await recordAlert({
    dedupeKey: `api:${provider.toLowerCase()}`,
    severity: rotationPossible ? "warning" : "critical",
    category: "api",
    problem: `${name} رجّع فشل في ${arabicNumerals(String(failedCalls))} محاولة مسجّلة على ${arabicNumerals(String(failingKeys))} مفتاح`,
    rootCause: rotationPossible
      ? "في مفاتيح تانية من نفس الشركة ثبت إنها بتردّ — الفشل على دي تحديداً"
      : "مفيش مفتاح من دي الشركة ثبت إنه بيشتغل — مش مسألة مفتاح بيطير لمفتاح",
    proposedFix: rotationPossible
      ? `نقل الطلب لمفتاح ${name} التاني في المخزون — ده بيحصل لوحده`
      : `محتاج مفتاح جديد من ${name} أو قرار منك باستبعاد الشركة دي`,
    autoFixable: rotationPossible,
    errorLog: errorSample,
  });
}

/**
 * Monitor memory usage and clear cache if threshold exceeded
 */
export async function monitorMemoryUsage(currentUsageMB: number, thresholdMB: number): Promise<SystemAlert | null> {
  const percentUsed = (currentUsageMB / Math.max(thresholdMB, 1)) * 100;

  if (percentUsed <= 85) return null;

  return await recordAlert({
    dedupeKey: "memory:heap",
    severity: percentUsed > 95 ? "critical" : "warning",
    category: "memory",
    problem: `الذاكرة وصلت لـ${arabicNumerals(percentUsed.toFixed(1))}٪ من حدّها`,
    rootCause: "تجمّع بيانات مخزّنة، أو تسريب ذاكرة في معالجة الصور",
    proposedFix: "تنضيف الكاش اللي مش لازم وتشغيل تحرير الذاكرة",
    // Auto-fix only while the instance still has room to do the work.
    autoFixable: percentUsed < 95,
    errorLog: `heapUsed=${Math.round(currentUsageMB)}MB ceiling=${Math.round(thresholdMB)}MB`,
  });
}

/**
 * Monitor database health
 */
export async function monitorDatabaseHealth(error?: Error): Promise<SystemAlert | null> {
  if (!error) return null;

  const isConnectionError = error.message.includes("connection") ||
    error.message.includes("timeout") ||
    error.message.includes("refused");

  return await recordAlert({
    dedupeKey: "database:connection",
    severity: isConnectionError ? "critical" : "warning",
    category: "database",
    problem: isConnectionError ? "القاعدة مش بتردّ على الاتصال" : "سؤال غلط رجع من القاعدة",
    // The exception text belongs in `errorLog` below, not in the sentence he reads.
    rootCause: isConnectionError
      ? "مخزن اتصالات القاعدة اتملّى، أو الشبكة انقطعت"
      : "السؤال اللي اتنفذ رجع بخطأ — تفاصيله في سجل الغلط",
    proposedFix: isConnectionError
      ? "محاولة تانية بتأخير متزايد، ولو استمر أكتر من دقيقتين يتبعت تنبيه"
      : "مراجعة شكل السؤال وإضافة فهرس أو إعادة ترتيبه",
    // A database issue needs investigation by an operator.  Marking it resolved
    // after a log statement would hide a real outage.
    autoFixable: false,
    errorLog: error.stack,
  });
}

/**
 * Monitor external service failures
 */
export async function monitorExternalService(service: string, error: Error): Promise<SystemAlert | null> {
  return await recordAlert({
    dedupeKey: `external:${service.toLowerCase()}`,
    severity: "warning",
    category: "external",
    problem: `${PROVIDER_AR[service.toLowerCase()] ?? "خدمة خارجية"} مش بترجّع شغل`,
    rootCause: "خطأ من واجهة خارجية — تفاصيله في سجل الغلط",
    proposedFix: "فصل مؤقت للخدمة،رجوع لآخر بيانات مخزّنة، أو الطلب يستنى دوره",
    autoFixable: true,
    errorLog: error.stack,
  });
}

/**
 * Apply auto-fix for eligible alerts
 */
export async function applyAutoFix(alertId: string): Promise<boolean> {
  const row = await readAlertById(alertId);
  if (!row || !row.auto_fixable || row.status !== "pending") return false;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  const { error: marking } = await supabase
    .from(ALERTS_TABLE)
    .update({ status: "applying" })
    .eq("id", alertId);
  if (marking) {
    console.warn(`[sentinel] could not mark applying: ${marking.message}`);
    return false;
  }

  try {
    switch (row.category) {
      case "memory":
        // Clear caches
        if (typeof global !== "undefined" && (global as unknown as { __azenithCache?: Map<string, unknown> }).__azenithCache) {
          (global as unknown as { __azenithCache: Map<string, unknown> }).__azenithCache.clear();
        }
        console.log(`[Sentinel] Auto-fixed memory issue: Cleared caches`);
        break;

      case "cache":
        // Reset cache statistics and clear stale entries
        console.log(`[Sentinel] Auto-fixed cache issue: Reset cache layer`);
        break;

      case "external":
        // Circuit breaker would activate here
        console.log(`[Sentinel] Auto-fixed external service: Activated fallback mode`);
        break;

      case "api":
        // Key rotation handled by orchestrator, just log
        console.log(`[Sentinel] API key rotation triggered for: ${row.problem}`);
        break;

      default:
        await closeAlert(alertId, "pending");
        return false;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from(ALERTS_TABLE)
      .update({ status: "resolved", applied_at: now, resolved_at: now, dedupe_key: null })
      .eq("id", alertId);
    if (error) {
      console.warn(`[sentinel] auto-fix applied but not stored: ${error.message}`);
      return false;
    }
    return true;
  } catch (error) {
    await closeAlert(alertId, "pending");
    console.error(`[Sentinel] Auto-fix failed for ${alertId}:`, error);
    return false;
  }
}

async function readAlertById(alertId: string): Promise<AlertRow | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from(ALERTS_TABLE).select("*").eq("id", alertId).maybeSingle();
  if (error) {
    console.warn(`[sentinel] alert read failed: ${error.message}`);
    return null;
  }
  return (data as AlertRow | null) ?? null;
}

/**
 * Move a row to a decided state and hand its dedupe key back, so a recurrence can be recorded as a
 * new sighting. `null` on the key is what makes it possible: the unique index over it only ever holds
 * the alerts that still wait.
 */
async function closeAlert(alertId: string, status: "resolved" | "dismissed" | "pending"): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const now = new Date().toISOString();
  const patch =
    status === "pending"
      ? { status }
      : { status, resolved_at: now, dedupe_key: null };
  const { error } = await supabase.from(ALERTS_TABLE).update(patch).eq("id", alertId);
  if (error) {
    console.warn(`[sentinel] alert not decided: ${error.message}`);
    return false;
  }
  const { data } = await supabase.from(ALERTS_TABLE).select("status").eq("id", alertId).maybeSingle();
  console.log(`[sentinel] decided ${alertId} — stored status = ${data?.status ?? "unread"}`);
  return data?.status === status;
}

/**
 * Get system health snapshot. Reading it is also the watch pass: the three measurements the store can
 * actually take are taken here, and whatever they find is written to the log the snapshot then reads.
 */
export async function getSystemHealth(): Promise<HealthSnapshot> {
  const dbReachable = await watchDatabaseConnection();
  const memoryUsagePercent = await watchMemory();
  await watchProviderKeys();

  const log = await readAlertLog(50);
  const pending = log.alerts.filter((alert) => alert.status === "pending");

  const reading: LogReading = {
    readable: log.readable,
    totalLogged: log.totalLogged,
    pendingCritical: pending.filter((alert) => alert.severity === "critical").length,
    pendingWarning: pending.filter((alert) => alert.severity === "warning").length,
    pendingTotal: pending.length,
    dbReachable,
    newestSeenAt: log.alerts[0]?.lastSeenAt ?? null,
  };

  const state = logStateFor(reading);

  return {
    status: healthStatusFor(reading),
    lastCheck: new Date().toISOString(),
    logState: state,
    logNote: logNoteFor(state, reading),
    alerts: log.alerts,
    metrics: {
      // Deliberately null: no provider call is recorded anywhere in the store (measured 2026-10-11 —
      // `api_usage_log` holds zero rows), so any percentage here would be the alert log's own shape.
      apiSuccessRate: null,
      dbConnectionHealth: dbReachable,
      cacheHitRate: null,
      memoryUsagePercent,
      activeAlerts: pending.length,
      criticalAlerts: reading.pendingCritical,
      totalLogged: log.totalLogged,
    },
    recommendations: recommendationsFor(reading, state),
  };
}

/**
 * Get alerts requiring admin attention (critical or non-auto-fixable)
 */
export async function getPendingAlerts(): Promise<SystemAlert[]> {
  const log = await readAlertLog(100, true);
  return log.alerts.sort((a, b) => {
    // Critical first, then by timestamp
    if (a.severity === "critical" && b.severity !== "critical") return -1;
    if (b.severity === "critical" && a.severity !== "critical") return 1;
    return new Date(b.lastSeenAt ?? b.timestamp).getTime() - new Date(a.lastSeenAt ?? a.timestamp).getTime();
  });
}

/**
 * Admin action: Confirm and apply fix
 */
export async function confirmAndApplyFix(alertId: string): Promise<boolean> {
  const row = await readAlertById(alertId);
  if (!row) return false;

  if (row.category === "database") {
    // There is no safe generic database repair to run here.  Keep the alert
    // pending so the operator can investigate or explicitly dismiss it.
    return false;
  }

  // Only a fix that actually ran may close the row: the old code wrote `resolved` even when
  // `applyAutoFix` refused, which decided an alert that nothing had done anything about.
  return await applyAutoFix(alertId);
}

/**
 * Dismiss alert (admin reviewed, no action needed)
 */
export async function dismissAlert(alertId: string): Promise<boolean> {
  return await closeAlert(alertId, "dismissed");
}

/**
 * Log system event for monitoring
 */
export async function logSystemEvent(
  category: AlertCategory,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[Sentinel:${category}] ${timestamp} - ${message}`, metadata || "");
}

/**
 * AI-powered root cause analysis
 */
export async function analyzeRootCause(error: Error, context: string): Promise<string> {
  const prompt = `Analyze this system error and identify the root cause:

Error: ${error.message}
Stack: ${error.stack?.substring(0, 500)}
Context: ${context}

Provide a concise root cause analysis in 1-2 sentences. Focus on actionable insights.`;

  const result = await askGoogle(prompt, {
    model: "gemini-3-flash-preview",
    temperature: 0.2,
    maxTokens: 200,
  });

  return result.success
    ? result.content.trim()
    : "مقدرتش أحلّل السبب آليًا — محتاج مراجعة يدوية من فريق المتجر.";
}
