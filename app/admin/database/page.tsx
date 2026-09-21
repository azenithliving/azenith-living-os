"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  ServerCog,
  ShieldAlert,
} from "lucide-react";

type AlertSeverity = "info" | "warning" | "critical";

type SystemAlert = {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  category: string;
  problem: string;
  rootCause: string;
  proposedFix: string;
  autoFixable: boolean;
};

type HealthResponse = {
  ok?: boolean;
  message?: string;
  health?: {
    status: "healthy" | "degraded" | "critical";
    lastCheck: string;
    metrics: {
      apiSuccessRate: number;
      dbConnectionHealth: boolean;
      memoryUsagePercent: number;
      activeAlerts: number;
      criticalAlerts: number;
    };
    recommendations: string[];
  };
  pendingAlerts?: SystemAlert[];
};

const severityClass: Record<AlertSeverity, string> = {
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-100",
};

export default function DatabasePage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/system-health", { cache: "no-store" });
      const result = (await response.json()) as HealthResponse;
      if (!response.ok || !result.ok || !result.health) {
        throw new Error(result.message || "تعذر قراءة حالة النظام.");
      }
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر قراءة حالة النظام.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const handleAlertAction = async (alertId: string, action: "applyFix" | "dismiss") => {
    setActionId(alertId);
    setError(null);

    try {
      const response = await fetch("/api/system-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, alertId }),
      });
      const result = (await response.json()) as HealthResponse;
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "تعذر تنفيذ الإجراء.");
      }
      await loadHealth();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setActionId(null);
    }
  };

  const health = data?.health;
  const metrics = health?.metrics;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 lg:p-8" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Database className="h-8 w-8 text-[#C5A059]" />
            <h1 className="text-3xl font-black text-white">حالة البيانات والنظام</h1>
          </div>
          <p className="mt-2 text-sm text-white/50">
            مؤشرات مباشرة من فحص الخادم، وليست تقديرات أو أرقامًا ثابتة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHealth()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-[#C5A059]/50 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          تحديث الفحص
        </button>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-56 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#C5A059]" />
        </div>
      ) : health && metrics ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HealthMetric
              label="اتصال قاعدة البيانات"
              value={metrics.dbConnectionHealth ? "متصل" : "غير متصل"}
              tone={metrics.dbConnectionHealth ? "good" : "bad"}
              icon={<Database className="h-5 w-5" />}
            />
            <HealthMetric
              label="نجاح واجهات البرمجة"
              value={`${metrics.apiSuccessRate}%`}
              tone={metrics.apiSuccessRate >= 95 ? "good" : "warning"}
              icon={<ServerCog className="h-5 w-5" />}
            />
            <HealthMetric
              label="استخدام الذاكرة"
              value={`${metrics.memoryUsagePercent}%`}
              tone={metrics.memoryUsagePercent < 85 ? "good" : "warning"}
              icon={<ServerCog className="h-5 w-5" />}
            />
            <HealthMetric
              label="تنبيهات نشطة"
              value={metrics.activeAlerts}
              tone={metrics.criticalAlerts > 0 ? "bad" : metrics.activeAlerts > 0 ? "warning" : "good"}
              icon={<ShieldAlert className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">نتيجة آخر فحص</h2>
                <p className="mt-1 text-sm text-white/45">
                  {new Date(health.lastCheck).toLocaleString("ar-EG")}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                health.status === "healthy"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : health.status === "degraded"
                    ? "bg-amber-500/10 text-amber-300"
                    : "bg-rose-500/10 text-rose-300"
              }`}>
                {health.status === "healthy" ? "سليم" : health.status === "degraded" ? "يحتاج متابعة" : "حرج"}
              </span>
            </div>
            {health.recommendations.length > 0 ? (
              <ul className="mt-5 space-y-2 text-sm text-white/60">
                {health.recommendations.map((recommendation) => (
                  <li key={recommendation} className="flex gap-2">
                    <span className="text-[#C5A059]">•</span>
                    {recommendation}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-emerald-300">لا توجد توصيات معلّقة من الفحص.</p>
            )}
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">التنبيهات التي تحتاج قرارًا</h2>
                <p className="mt-1 text-sm text-white/45">كل إجراء هنا يحدّث حالة التنبيه على الخادم.</p>
              </div>
              <Link href="/admin/agents?tab=assistant" className="text-sm text-[#E5C170] hover:underline">
                فتح مركز الوكلاء
              </Link>
            </div>

            {(data.pendingAlerts?.length ?? 0) === 0 ? (
              <div className="flex items-center gap-3 py-10 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
                لا توجد تنبيهات معلّقة.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {data.pendingAlerts?.map((alert) => (
                  <article key={alert.id} className={`rounded-2xl border p-5 ${severityClass[alert.severity]}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider opacity-70">
                          <span>{alert.category}</span>
                          <span>•</span>
                          <span>{new Date(alert.timestamp).toLocaleString("ar-EG")}</span>
                        </div>
                        <h3 className="mt-2 font-bold">{alert.problem}</h3>
                        <p className="mt-2 text-sm opacity-80">السبب المحتمل: {alert.rootCause}</p>
                        <p className="mt-1 text-sm opacity-80">المقترح: {alert.proposedFix}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {alert.autoFixable ? (
                          <button
                            type="button"
                            onClick={() => void handleAlertAction(alert.id, "applyFix")}
                            disabled={actionId === alert.id}
                            className="rounded-xl bg-[#C5A059] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#E5C170] disabled:opacity-50"
                          >
                            {actionId === alert.id ? "جارٍ التنفيذ…" : "تطبيق المقترح"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleAlertAction(alert.id, "dismiss")}
                          disabled={actionId === alert.id}
                          className="rounded-xl border border-current/30 px-4 py-2 text-xs font-bold transition hover:bg-black/10 disabled:opacity-50"
                        >
                          مراجعة وإخفاء
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function HealthMetric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone: "good" | "warning" | "bad";
  icon: React.ReactNode;
}) {
  const color = {
    good: "text-emerald-300 border-emerald-500/20 bg-emerald-500/5",
    warning: "text-amber-300 border-amber-500/20 bg-amber-500/5",
    bad: "text-rose-300 border-rose-500/20 bg-rose-500/5",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-75">{label}</p>
        {icon}
      </div>
      <p className="mt-4 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
