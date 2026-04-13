"use client";

/**
 * Sovereign OS Arsenal - The Intelligent HUD
 * 
 * Features:
 * - The Resource Shield: Semantic caching stats
 * - Intelligence Scaling Engine: Processing depth & parallel execution
 * - Self-Healing: Auto-recovery status
 * - Manual Arsenal Management: Groq, OpenRouter, Mistral, Pexels
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Key,
  Database,
  TrendingUp,
  Cpu,
  Layers,
} from "lucide-react";

// Types
interface ArsenalKey {
  id: string;
  keyFragment: string;
  status: "active" | "cooling" | "disabled" | "failed";
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rateLimitPerMinute: number;
  cooldownUntil?: string;
  processingDepth: number;
  lastUsedAt?: string;
}

interface ProviderStats {
  total: number;
  active: number;
  cooling: number;
  disabled: number;
  totalCalls: number;
  successRate: number;
  keys: ArsenalKey[];
}

interface SystemStats {
  providers: {
    groq: ProviderStats;
    openrouter: ProviderStats;
    mistral: ProviderStats;
    pexels: ProviderStats;
  };
  cacheEfficiency: {
    totalEntries: number;
    totalHits: number;
    avgQuality: number;
    todaySavings: number;
    hitRate: number;
    estimatedSaved: number;
  };
  systemHealth: {
    criticalEvents24h: number;
    warnings24h: number;
    lastEvent?: {
      type: string;
      message: string;
      at: string;
    };
  };
}

// Provider Configuration
const PROVIDER_CONFIG = {
  groq: {
    name: "Groq",
    description: "Ultra-fast inference for instant UI responses",
    color: "#F55036",
    icon: Zap,
    features: ["3s timeout", "Llama 3.3 70B", "Rate: 30/min"],
  },
  openrouter: {
    name: "OpenRouter",
    description: "Premium quality for luxury content generation",
    color: "#8B5CF6",
    icon: Layers,
    features: ["8s timeout", "Claude 3.7 Sonnet", "Rate: 20/min"],
  },
  mistral: {
    name: "Mistral",
    description: "Validation and failover backup system",
    color: "#10B981",
    icon: Shield,
    features: ["5s timeout", "Mistral Large", "Rate: 60/min"],
  },
  pexels: {
    name: "Pexels",
    description: "Image search for visual content",
    color: "#07A081",
    icon: Database,
    features: ["Image API", "Royalty-free", "Rate: 200/hr"],
  },
};

// Utility Components
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Badge({ 
  children, 
  variant = "default" 
}: { 
  children: React.ReactNode; 
  variant?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const variants = {
    default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-amber-600 hover:bg-amber-700 text-white",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    ghost: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${variants[variant]} ${className}`}
    >
      {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// Components
function EfficiencyGauge({ savings }: { savings: number }) {
  const getColor = (value: number) => {
    if (value >= 70) return "text-green-500";
    if (value >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getLabel = (value: number) => {
    if (value >= 70) return "ممتاز";
    if (value >= 40) return "جيد";
    if (value >= 20) return "مقبول";
    return "يحتاج تحسين";
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">مؤشر كفاءة الاستهلاك</h3>
      </div>

      <div className="flex items-center justify-center py-4">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200 dark:text-gray-800"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${savings * 2.51} 251`}
              className={getColor(savings)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${getColor(savings)}`}>{savings.toFixed(1)}%</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">توفير</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Badge variant={savings >= 70 ? "success" : savings >= 40 ? "warning" : "danger"}>
          {getLabel(savings)}
        </Badge>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">التوفير المقدر:</span>
          <span className="font-semibold text-green-600 dark:text-green-400">${savings > 0 ? (savings * 0.1).toFixed(2) : "0.00"}</span>
        </div>
      </div>
    </Card>
  );
}

function ProviderSection({
  provider,
  stats,
  onKeyAction,
}: {
  provider: keyof typeof PROVIDER_CONFIG;
  stats: ProviderStats;
  onKeyAction: (keyId: string, action: "activate" | "cooldown" | "disable") => void;
}) {
  const config = PROVIDER_CONFIG[provider];
  const Icon = config.icon;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "cooling":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "disabled":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      case "failed":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "success" | "warning" | "danger" | "default" => {
    switch (status) {
      case "active":
        return "success";
      case "cooling":
        return "warning";
      case "disabled":
        return "default";
      case "failed":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-6 h-6" style={{ color: config.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{config.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{config.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {config.features.map((feature) => (
              <span
                key={feature}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">المفاتيح الكلية</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">نشطة</div>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.cooling}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">في التبريد</div>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.successRate}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">معدل النجاح</div>
          </div>
        </div>
      </div>

      {stats.keys.length > 0 && (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {stats.keys.map((key) => (
            <div key={key.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="flex items-center gap-3">
                {getStatusIcon(key.status)}
                <div>
                  <div className="font-mono text-sm text-gray-900 dark:text-white">
                    {key.keyFragment}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStatusVariant(key.status)}>
                      {key.status === "active" ? "نشط" : key.status === "cooling" ? "تبريد" : key.status === "disabled" ? "معطل" : "فاشل"}
                    </Badge>
                    {key.cooldownUntil && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        حتى {new Date(key.cooldownUntil).toLocaleTimeString("ar-SA")}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {key.totalCalls.toLocaleString()} عملية
                    </span>
                    {key.processingDepth > 1 && (
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        عمق {key.processingDepth}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {key.status !== "active" && (
                  <button
                    onClick={() => onKeyAction(key.id, "activate")}
                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    title="تفعيل"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                )}
                {key.status !== "cooling" && key.status !== "disabled" && (
                  <button
                    onClick={() => onKeyAction(key.id, "cooldown")}
                    className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                    title="تبريد"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                )}
                {key.status !== "disabled" && (
                  <button
                    onClick={() => onKeyAction(key.id, "disable")}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="تعطيل"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CacheStats({ stats, onClear }: { stats: SystemStats["cacheEfficiency"]; onClear: () => void }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">الكاش الدلالي</h3>
        </div>
        <Button variant="danger" onClick={onClear} className="text-sm">
          <Trash2 className="w-4 h-4" />
          تطهير الكاش
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {stats.totalEntries.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">مدخلات الكاش</div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {stats.totalHits.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">إجمالي الاستخدامات</div>
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {stats.hitRate}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">معدل الإصابة</div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
            ${stats.estimatedSaved.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">توفير مقدر</div>
        </div>
      </div>
    </Card>
  );
}

function SystemHealth({ health, onHeal }: { health: SystemStats["systemHealth"]; onHeal: () => void }) {
  const hasCritical = health.criticalEvents24h > 0;
  const hasWarnings = health.warnings24h > 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">الصحة الذاتية</h3>
        </div>
        <Button variant="secondary" onClick={onHeal} className="text-sm">
          <RefreshCw className="w-4 h-4" />
          شفاء يدوي
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">أحداث حرجة (24س):</span>
          <Badge variant={hasCritical ? "danger" : "success"}>
            {health.criticalEvents24h}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">تحذيرات (24س):</span>
          <Badge variant={hasWarnings ? "warning" : "success"}>
            {health.warnings24h}
          </Badge>
        </div>

        {health.lastEvent && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">آخر حدث:</div>
            <div className="text-sm text-gray-900 dark:text-white">{health.lastEvent.message}</div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(health.lastEvent.at).toLocaleString("ar-SA")}
            </div>
          </div>
        )}
      </div>

      {hasCritical && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">يوجد خطر توقف وشيك!</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// Main Page
export default function ArsenalPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/arsenal");
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleKeyAction = async (keyId: string, action: "activate" | "cooldown" | "disable") => {
    const statusMap = {
      activate: "active",
      cooldown: "cooling",
      disable: "disabled",
    };

    setActionLoading(keyId);
    try {
      const response = await fetch("/api/admin/arsenal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-key-status",
          payload: { keyId, status: statusMap[action] },
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Error updating key:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearCache = async () => {
    if (!confirm("هل أنت متأكد من تطهير الكاش؟ سيؤدي هذا لإعادة استهلاك API.")) return;

    setActionLoading("clear-cache");
    try {
      const response = await fetch("/api/admin/arsenal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-cache" }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Error clearing cache:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerHeal = async () => {
    setActionLoading("heal");
    try {
      const response = await fetch("/api/admin/arsenal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger-heal" }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStats();
      }
    } catch (error) {
      console.error("Error triggering heal:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-gray-600 dark:text-gray-400">جاري تحميل الأرسنال...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">فشل تحميل البيانات</h2>
          <Button onClick={fetchStats}>إعادة المحاولة</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" dir="rtl">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                <Cpu className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  نظام التشغيل السيادي الذكي
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  نظام إدارة الموارد المتقدم | أقصى قوة، أدنى استهلاك
                </p>
              </div>
            </div>
            <Button onClick={fetchStats} variant="secondary" loading={loading}>
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <EfficiencyGauge savings={stats.cacheEfficiency.todaySavings} />
          <CacheStats
            stats={stats.cacheEfficiency}
            onClear={handleClearCache}
          />
          <SystemHealth
            health={stats.systemHealth}
            onHeal={handleTriggerHeal}
          />
        </div>

        {/* Provider Sections */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            درع الموارد (Resource Shield)
          </h2>

          <ProviderSection
            provider="groq"
            stats={stats.providers.groq}
            onKeyAction={handleKeyAction}
          />

          <ProviderSection
            provider="openrouter"
            stats={stats.providers.openrouter}
            onKeyAction={handleKeyAction}
          />

          <ProviderSection
            provider="mistral"
            stats={stats.providers.mistral}
            onKeyAction={handleKeyAction}
          />

          <ProviderSection
            provider="pexels"
            stats={stats.providers.pexels}
            onKeyAction={handleKeyAction}
          />
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            نظام التشغيل السيادي الذكي v1.0 | يزداد ذكاءً مع كل مفتاح تضيفه
          </p>
        </div>
      </div>
    </div>
  );
}
