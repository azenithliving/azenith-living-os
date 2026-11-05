/**
 * Runs the watcher exactly as the shipping door does — the real module, the real database client,
 * zero injected fakes — and prints what the log holds. Run it twice as two separate processes: a
 * second process starts with nothing in its memory, which is precisely what a second serverless
 * invocation does. If the alert appears in both runs, it outlived the request that wrote it.
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/prove-alert-log.cts
 */
import { getSystemHealth, getPendingAlerts } from "@/lib/sentinel";

async function main(): Promise<void> {
  const health = await getSystemHealth();
  const pending = await getPendingAlerts();

  console.log(JSON.stringify({
    pid: process.pid,
    status: health.status,
    logState: health.logState,
    logNote: health.logNote,
    totalLogged: health.metrics.totalLogged,
    activeAlerts: health.metrics.activeAlerts,
    apiSuccessRate: health.metrics.apiSuccessRate,
    memoryUsagePercent: health.metrics.memoryUsagePercent,
    dbReachable: health.metrics.dbConnectionHealth,
    recommendations: health.recommendations,
    pending: pending.map((alert) => ({
      id: alert.id,
      first: alert.timestamp,
      seen: alert.lastSeenAt,
      occurrences: alert.occurrences,
      category: alert.category,
      categoryAr: alert.categoryAr,
      severity: alert.severity,
      autoFixable: alert.autoFixable,
      problem: alert.problem,
      cause: alert.rootCause,
      fix: alert.proposedFix,
      logChars: (alert.errorLog ?? "").length,
    })),
  }, null, 1));
}

void main();
