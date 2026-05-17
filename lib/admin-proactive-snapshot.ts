import { getSystemHealth } from "@/lib/architect-tools";
import { checkAacaHealth } from "@/lib/aaca-client";
import { listAssistantExecutions } from "@/lib/admin-assistant-log";

export interface ProactiveAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href?: string;
}

export async function getAdminProactiveSnapshot(userId: string): Promise<{
  alerts: ProactiveAlert[];
  agentsReady: boolean;
  healthOk: boolean;
}> {
  const alerts: ProactiveAlert[] = [];

  const [health, agents, executions] = await Promise.all([
    getSystemHealth().catch(() => ({ success: false, message: "" })),
    checkAacaHealth(),
    listAssistantExecutions(userId, 5).catch(() => []),
  ]);

  const agentsReady = agents.status === "READY";
  const healthOk = health.success !== false;

  if (!agentsReady) {
    alerts.push({
      id: "agents-offline",
      severity: "warning",
      title: "الوكلاء غير جاهزين",
      description: "افتح المساعد الموحّد لتشغيل مهمة أو تحقق من الإعدادات.",
      href: "/admin/assistant",
    });
  }

  if (!healthOk) {
    alerts.push({
      id: "health-degraded",
      severity: "warning",
      title: "صحة النظام تحتاج مراجعة",
      description: health.message || "شغّل فحص الصحة من المساعد.",
      href: "/admin/assistant",
    });
  }

  const failed = (executions || []).filter(
    (e) => e.execution_status === "failed" || e.execution_status === "error"
  );
  if (failed.length > 0) {
    alerts.push({
      id: "recent-failures",
      severity: "info",
      title: `${failed.length} تنفيذ فاشل مؤخراً`,
      description: "راجع سجل التنفيذ في المساعد الموحّد.",
      href: "/admin/assistant",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      severity: "info",
      title: "كل شيء يبدو مستقراً",
      description: "استخدم المساعد الموحّد لأي مهمة جديدة.",
      href: "/admin/assistant",
    });
  }

  return { alerts, agentsReady, healthOk };
}
