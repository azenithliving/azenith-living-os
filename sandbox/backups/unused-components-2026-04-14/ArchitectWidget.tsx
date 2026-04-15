"use client";

/**
 * Architect Widget - Dashboard Integration
 * 
 * Shows:
 * - Quick access to Command Horizon
 * - Recent system alerts
 * - Proactive insights
 * - Health status summary
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Activity,
  ArrowRight,
  Clock,
  Zap,
  Shield,
  Terminal,
} from "lucide-react";

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  metrics: Array<{
    name: string;
    value: number;
    severity: "info" | "low" | "medium" | "high" | "critical";
  }>;
  predictions: Array<{
    metric: string;
    probability: number;
    impact: string;
  }>;
  lastCheck: string;
}

interface RecentAlert {
  id: string;
  title: string;
  message: string;
  priority: string;
  created_at: string;
}

export function ArchitectWidget() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
    fetchRecentAlerts();
  }, []);

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/admin/proactive");
      const data = await response.json();
      if (data.success) {
        setHealth(data.health);
      }
    } catch (error) {
      console.error("Failed to fetch health:", error);
    }
  };

  const fetchRecentAlerts = async () => {
    try {
      // This would fetch from the notifications table
      // For now, we'll use mock data
      setAlerts([]);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (health?.status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "critical":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (health?.status) {
      case "healthy":
        return "النظام بصحة جيدة";
      case "degraded":
        return "أداء منخفض";
      case "critical":
        return "مشاكل حرجة!";
      default:
        return "جاري التحميل...";
    }
  };

  const getStatusColor = () => {
    switch (health?.status) {
      case "healthy":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "degraded":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      case "critical":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      default:
        return "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">المهندس الأول</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Proactive Autonomy Active</p>
            </div>
          </div>
          <Link
            href="/admin/architect"
            className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
          >
            فتح Command Horizon
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Status */}
      <div className={`p-4 mx-6 my-4 rounded-xl border ${getStatusColor()}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">{getStatusText()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              آخر فحص: {health?.lastCheck ? new Date(health.lastCheck).toLocaleTimeString("ar-SA") : "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 px-6 pb-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {health?.metrics.length || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">مؤشرات</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            {health?.predictions.length || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">تنبؤات</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {alerts.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">تنبيهات</div>
        </div>
      </div>

      {/* Predictions */}
      {health?.predictions && health.predictions.length > 0 && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            رؤى استباقية
          </h4>
          <div className="space-y-2">
            {health.predictions.slice(0, 3).map((pred, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pred.metric}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {(pred.probability * 100).toFixed(0)}% احتمالية
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">تنبيهات حديثة</h4>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{alert.message}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(alert.created_at).toLocaleTimeString("ar-SA")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!health?.predictions?.length && !alerts.length) && (
        <div className="px-6 pb-6 text-center">
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <Terminal className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              كل شيء يعمل بكفاءة. لا توجد تنبيهات أو تنبؤات حالياً.
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Zap className="w-4 h-4" />
            <span>المراقبة الحية نشطة</span>
          </div>
          <Link
            href="/admin/arsenal"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            عرض الأرسنال
          </Link>
        </div>
      </div>
    </div>
  );
}
