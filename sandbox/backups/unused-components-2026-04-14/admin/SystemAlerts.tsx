"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { SystemAlert, HealthSnapshot } from "@/lib/sentinel";

/**
 * System Alerts Dashboard
 * Displays critical system issues with one-click fix proposals
 */

interface SystemAlertsProps {
  health: HealthSnapshot | null;
  onApplyFix: (alertId: string) => Promise<boolean>;
  onDismiss: (alertId: string) => Promise<boolean>;
  isLoading?: boolean;
  className?: string;
}

const severityConfig = {
  critical: { 
    emoji: "🔴", 
    color: "red", 
    bg: "bg-red-500/10", 
    border: "border-red-400/30",
    text: "text-red-300",
    label: "CRITICAL" 
  },
  warning: { 
    emoji: "🟠", 
    color: "amber", 
    bg: "bg-amber-500/10", 
    border: "border-amber-400/30",
    text: "text-amber-300",
    label: "WARNING" 
  },
  info: { 
    emoji: "🔵", 
    color: "blue", 
    bg: "bg-blue-500/10", 
    border: "border-blue-400/30",
    text: "text-blue-300",
    label: "INFO" 
  },
};

const categoryConfig = {
  api: { icon: "🔌", label: "API" },
  database: { icon: "🗄️", label: "Database" },
  cache: { icon: "⚡", label: "Cache" },
  memory: { icon: "🧠", label: "Memory" },
  external: { icon: "🌐", label: "External Service" },
};

export function SystemAlerts({
  health,
  onApplyFix,
  onDismiss,
  isLoading = false,
  className = "",
}: SystemAlertsProps) {
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-8 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
          <span className="text-white/60">Checking system health...</span>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-8 ${className}`}>
        <p className="text-center text-white/60">System health data unavailable</p>
      </div>
    );
  }

  const pendingAlerts = health.alerts.filter((a) => a.status === "pending");
  const criticalCount = pendingAlerts.filter((a) => a.severity === "critical").length;

  const handleApplyFix = async (alertId: string) => {
    setProcessingId(alertId);
    try {
      await onApplyFix(alertId);
    } finally {
      setProcessingId(null);
      setActiveAlert(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setProcessingId(alertId);
    try {
      await onDismiss(alertId);
    } finally {
      setProcessingId(null);
      setActiveAlert(null);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">Sentinel AI</p>
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {criticalCount} CRITICAL
              </span>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-white">System Health Monitor</h2>
        </div>
        <div className="flex items-center gap-3">
          <HealthIndicator status={health.status} />
          <span className="text-xs text-white/40">
            Last check: {new Date(health.lastCheck).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="API Success Rate"
          value={`${health.metrics.apiSuccessRate.toFixed(1)}%`}
          status={health.metrics.apiSuccessRate > 95 ? "good" : health.metrics.apiSuccessRate > 90 ? "warning" : "critical"}
        />
        <MetricCard
          label="Database Health"
          value={health.metrics.dbConnectionHealth ? "Healthy" : "Degraded"}
          status={health.metrics.dbConnectionHealth ? "good" : "critical"}
        />
        <MetricCard
          label="Cache Hit Rate"
          value={`${health.metrics.cacheHitRate.toFixed(1)}%`}
          status={health.metrics.cacheHitRate > 80 ? "good" : health.metrics.cacheHitRate > 60 ? "warning" : "critical"}
        />
        <MetricCard
          label="Memory Usage"
          value={`${health.metrics.memoryUsagePercent.toFixed(1)}%`}
          status={health.metrics.memoryUsagePercent < 70 ? "good" : health.metrics.memoryUsagePercent < 85 ? "warning" : "critical"}
        />
      </div>

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <h3 className="mb-2 font-medium text-amber-300">AI Recommendations</h3>
          <ul className="space-y-1">
            {health.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                <span className="text-amber-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        <h3 className="font-medium text-white">
          Pending Alerts ({pendingAlerts.length})
        </h3>

        {pendingAlerts.length === 0 ? (
          <div className="rounded-xl border border-green-400/30 bg-green-500/10 p-6 text-center">
            <span className="text-3xl">✅</span>
            <p className="mt-2 text-green-300">All systems operational. No pending alerts.</p>
          </div>
        ) : (
          pendingAlerts.map((alert) => {
            const severity = severityConfig[alert.severity];
            const category = categoryConfig[alert.category];
            const isActive = activeAlert === alert.id;
            const isProcessing = processingId === alert.id;

            return (
              <motion.div
                key={alert.id}
                layout
                className={`rounded-xl border p-4 ${severity.bg} ${severity.border}`}
              >
                {/* Alert Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{severity.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase ${severity.text}`}>
                          {severity.label}
                        </span>
                        <span className="text-xs text-white/50">
                          {category.icon} {category.label}
                        </span>
                        <span className="text-xs text-white/40">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-white">{alert.problem}</h4>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveAlert(isActive ? null : alert.id)}
                      className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
                    >
                      {isActive ? "Hide Details" : "View Details"}
                    </button>
                    {alert.autoFixable && (
                      <button
                        onClick={() => handleApplyFix(alert.id)}
                        disabled={isProcessing}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
                      >
                        {isProcessing ? "Applying..." : "Auto-Fix"}
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      disabled={isProcessing}
                      className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 border-t border-white/10 pt-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-white/50">Root Cause</p>
                          <p className="mt-1 text-sm text-white/80">{alert.rootCause}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/50">Proposed Fix</p>
                          <p className="mt-1 text-sm text-white/80">{alert.proposedFix}</p>
                        </div>
                      </div>

                      {!alert.autoFixable && alert.severity === "critical" && (
                        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 p-3">
                          <p className="text-sm text-red-300">
                            ⚠️ This alert requires manual intervention. Please review the root cause 
                            and proposed fix carefully before taking action.
                          </p>
                          <button
                            onClick={() => handleApplyFix(alert.id)}
                            disabled={isProcessing}
                            className="mt-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-400"
                          >
                            {isProcessing ? "Processing..." : "Confirm Fix"}
                          </button>
                        </div>
                      )}

                      {alert.errorLog && (
                        <div className="mt-4">
                          <p className="text-xs text-white/50">Error Log</p>
                          <pre className="mt-1 max-h-32 overflow-auto rounded bg-black/30 p-2 text-xs text-white/60">
                            {alert.errorLog.substring(0, 500)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

function HealthIndicator({ status }: { status: "healthy" | "degraded" | "critical" }) {
  const config = {
    healthy: { color: "bg-green-500", label: "HEALTHY", pulse: false },
    degraded: { color: "bg-amber-500", label: "DEGRADED", pulse: true },
    critical: { color: "bg-red-500", label: "CRITICAL", pulse: true },
  }[status];

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.05] px-3 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${config.color} ${config.pulse ? "animate-pulse" : ""}`} />
      <span className={`text-xs font-medium ${status === "healthy" ? "text-green-400" : status === "degraded" ? "text-amber-400" : "text-red-400"}`}>
        {config.label}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "good" | "warning" | "critical";
}) {
  const colors = {
    good: "border-green-400/30 bg-green-500/10 text-green-300",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    critical: "border-red-400/30 bg-red-500/10 text-red-300",
  };

  return (
    <div className={`rounded-xl border p-3 ${colors[status]}`}>
      <p className="text-xs opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export default SystemAlerts;
