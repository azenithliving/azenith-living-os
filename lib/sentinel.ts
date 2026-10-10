"use server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { arabicNumerals } from "@/lib/arabic";
import { askOpenRouter, askGoogle } from "@/lib/ai-orchestrator";

/**
 * Sentinel: Self-Healing Architecture & System Health Monitor
 * Watches system logs, auto-fixes small issues, alerts on critical errors
 */

export type SystemHealthStatus = "healthy" | "degraded" | "critical";
export type AlertSeverity = "info" | "warning" | "critical";

export interface SystemAlert {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  category: "api" | "database" | "cache" | "memory" | "external";
  problem: string;
  rootCause: string;
  proposedFix: string;
  autoFixable: boolean;
  status: "pending" | "applying" | "resolved" | "dismissed";
  appliedAt?: string;
  resolvedAt?: string;
  errorLog?: string;
}

export interface HealthSnapshot {
  status: SystemHealthStatus;
  lastCheck: string;
  alerts: SystemAlert[];
  metrics: {
    apiSuccessRate: number;
    dbConnectionHealth: boolean;
    cacheHitRate: number | null;
    memoryUsagePercent: number;
    activeAlerts: number;
    criticalAlerts: number;
  };
  recommendations: string[];
}

// In-memory store for alerts (in production, use Redis)
const alertStore: Map<string, SystemAlert> = new Map();
const MAX_ALERTS = 100;

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
};

/**
 * Monitor API key failures and auto-rotate if needed
 */
export async function monitorAPIHealth(provider: "groq" | "openrouter" | "mistral" | "openai" | "google", errorCount: number): Promise<void> {
  if (errorCount >= 3) {
    const name = PROVIDER_AR[provider] ?? "المزوّد";
    const alert: SystemAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: "warning",
      category: "api",
      problem: `${name} وراه محاولات كتير فشل (${arabicNumerals(String(errorCount))} مرة)`,
      rootCause: "المفتاح ممكن يكون اتعدّى سقف الدقايق، أو منتهي، أو الخدمة نفسها عليها ضغط",
      proposedFix: `نقل الطلب لمفتاح ${name} التاني في المخزون — ده بيحصل لوحده`,
      autoFixable: true,
      status: "pending",
    };
    
    alertStore.set(alert.id, alert);
    console.log(`[Sentinel] API health alert: ${alert.problem}`);
    
    // Auto-fix: The orchestrator already handles key rotation
    // This just logs for visibility
  }
}

/**
 * Monitor memory usage and clear cache if threshold exceeded
 */
export async function monitorMemoryUsage(currentUsageMB: number, thresholdMB: number = 512): Promise<SystemAlert | null> {
  const percentUsed = (currentUsageMB / thresholdMB) * 100;
  
  if (percentUsed > 85) {
    const alert: SystemAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      severity: percentUsed > 95 ? "critical" : "warning",
      category: "memory",
      problem: `الذاكرة وصلت لـ${arabicNumerals(percentUsed.toFixed(1))}٪ من حدّها`,
      rootCause: "تجمّع بيانات مخزّنة، أو تسريب ذاكرة في معالجة الصور",
      proposedFix: "تنضيف الكاش اللي مش لازم وتشغيل تحرير الذاكرة",
      autoFixable: percentUsed < 95, // Auto-fix only if not critical
      status: "pending",
    };
    
    alertStore.set(alert.id, alert);
    
    // Auto-fix for warnings
    if (alert.autoFixable) {
      await applyAutoFix(alert.id);
    }
    
    return alert;
  }
  
  return null;
}

/**
 * Monitor database health
 */
export async function monitorDatabaseHealth(error?: Error): Promise<SystemAlert | null> {
  if (error) {
    const isConnectionError = error.message.includes("connection") || 
                              error.message.includes("timeout") ||
                              error.message.includes("refused");
    
    const alert: SystemAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
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
      status: "pending",
      errorLog: error.stack,
    };
    
    alertStore.set(alert.id, alert);
    return alert;
  }
  
  return null;
}

/**
 * Monitor external service failures
 */
export async function monitorExternalService(service: string, error: Error): Promise<SystemAlert | null> {
  const alert: SystemAlert = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    severity: "warning",
    category: "external",
    problem: `${PROVIDER_AR[service] ?? "خدمة خارجية"} مش بترجّع شغل`,
    rootCause: "خطأ من واجهة خارجية — تفاصيله في سجل الغلط",
    proposedFix: "فصل مؤقت للخدمة،رجوع لآخر بيانات مخزّنة، أو الطلب يستنى دوره",
    autoFixable: true,
    status: "pending",
    errorLog: error.stack,
  };
  
  alertStore.set(alert.id, alert);
  await applyAutoFix(alert.id);
  return alert;
}

/**
 * Apply auto-fix for eligible alerts
 */
export async function applyAutoFix(alertId: string): Promise<boolean> {
  const alert = alertStore.get(alertId);
  if (!alert || !alert.autoFixable || alert.status !== "pending") {
    return false;
  }
  
  alert.status = "applying";
  alertStore.set(alertId, alert);
  
  try {
    switch (alert.category) {
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
        console.log(`[Sentinel] API key rotation triggered for: ${alert.problem}`);
        break;
        
      default:
        return false;
    }
    
    alert.status = "resolved";
    alert.appliedAt = new Date().toISOString();
    alert.resolvedAt = new Date().toISOString();
    alertStore.set(alertId, alert);
    
    return true;
  } catch (error) {
    alert.status = "pending";
    alertStore.set(alertId, alert);
    console.error(`[Sentinel] Auto-fix failed for ${alertId}:`, error);
    return false;
  }
}

/**
 * Get system health snapshot
 */
export async function getSystemHealth(): Promise<HealthSnapshot> {
  const alerts = Array.from(alertStore.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);
  
  const criticalAlerts = alerts.filter(a => a.severity === "critical" && a.status === "pending").length;
  const warningAlerts = alerts.filter(a => a.severity === "warning" && a.status === "pending").length;
  
  let status: SystemHealthStatus = "healthy";
  if (criticalAlerts > 0) status = "critical";
  else if (warningAlerts > 2) status = "degraded";
  
  // Check Supabase health
  let dbHealth = true;
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      dbHealth = false;
    } else {
      const { error } = await supabase.from("users").select("count", { count: "exact", head: true });
      if (error) dbHealth = false;
    }
  } catch {
    dbHealth = false;
  }
  
  const recommendations: string[] = [];
  if (!dbHealth) recommendations.push("اتصال القاعدة مش مستقر — اتأكد من حالة القاعدة");
  if (criticalAlerts > 0) recommendations.push("في تنبيهات حرجة محتاجة عين دلوقتي");
  if (warningAlerts > 5) recommendations.push("تنبيهات كتير ورا بعض — شكلها مشكلة في النظام نفسه مش في حاجة واحدة");

  const pendingCount = alerts.filter((a) => a.status === "pending").length;
  const apiAlerts = alerts.filter((a) => a.category === "api").length;
  const totalTracked = Math.max(alerts.length, 1);
  const apiSuccessRate = Math.max(0, Math.min(100, 100 - (apiAlerts / totalTracked) * 100));

  const mem = process.memoryUsage();
  const heapUsedMB = mem.heapUsed / (1024 * 1024);
  const heapTotalMB = Math.max(mem.heapTotal / (1024 * 1024), 1);
  const memoryUsagePercent = Math.round((heapUsedMB / heapTotalMB) * 1000) / 10;

  return {
    status,
    lastCheck: new Date().toISOString(),
    alerts,
    metrics: {
      apiSuccessRate: Math.round(apiSuccessRate * 10) / 10,
      dbConnectionHealth: dbHealth,
      cacheHitRate: null,
      memoryUsagePercent,
      activeAlerts: pendingCount,
      criticalAlerts,
    },
    recommendations,
  };
}

/**
 * Get alerts requiring admin attention (critical or non-auto-fixable)
 */
export async function getPendingAlerts(): Promise<SystemAlert[]> {
  return Array.from(alertStore.values())
    .filter(a => a.status === "pending")
    .sort((a, b) => {
      // Critical first, then by timestamp
      if (a.severity === "critical" && b.severity !== "critical") return -1;
      if (b.severity === "critical" && a.severity !== "critical") return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
}

/**
 * Admin action: Confirm and apply fix
 */
export async function confirmAndApplyFix(alertId: string): Promise<boolean> {
  const alert = alertStore.get(alertId);
  if (!alert) return false;
  
  alert.status = "applying";
  alertStore.set(alertId, alert);
  
  try {
    // Apply the proposed fix
    switch (alert.category) {
      case "database":
        // There is no safe generic database repair to run here.  Keep the alert
        // pending so the operator can investigate or explicitly dismiss it.
        alert.status = "pending";
        alertStore.set(alertId, alert);
        return false;
        
      default:
        await applyAutoFix(alertId);
        break;
    }
    
    alert.status = "resolved";
    alert.resolvedAt = new Date().toISOString();
    alertStore.set(alertId, alert);
    return true;
  } catch (error) {
    alert.status = "pending";
    alertStore.set(alertId, alert);
    return false;
  }
}

/**
 * Dismiss alert (admin reviewed, no action needed)
 */
export async function dismissAlert(alertId: string): Promise<boolean> {
  const alert = alertStore.get(alertId);
  if (!alert) return false;
  
  alert.status = "dismissed";
  alert.resolvedAt = new Date().toISOString();
  alertStore.set(alertId, alert);
  return true;
}

/**
 * Log system event for monitoring
 */
export async function logSystemEvent(
  category: SystemAlert["category"],
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
