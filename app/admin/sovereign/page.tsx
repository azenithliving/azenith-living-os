"use client";

/**
 * The Sovereign Dashboard - Azenith Supreme Mastermind Interface
 * 
 * Features:
 * - Imperial command interface
 * - Triple-A Protocol visualization
 * - System status omniscient view
 * - Atomic rollback controls
 * - Proactive opportunity alerts
 */

import { useState, useEffect } from "react";
import {
  Crown,
  Brain,
  Shield,
  Zap,
  RotateCcw,
  Eye,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Sparkles,
  Command,
  Terminal,
} from "lucide-react";

interface MastermindStatus {
  awareness: {
    filesystem: {
      totalFiles: number;
      recentChanges: string[];
    };
    database: {
      totalTables: number;
      recordCounts: Record<string, number>;
    };
  };
  arsenal: {
    keysActive: number;
    efficiency: number;
    costSavings: number;
  };
  tripleA: {
    pendingActions: number;
    rollbacksAvailable: number;
  };
  soul: {
    brandAlignment: number;
  };
}

interface Opportunity {
  title: string;
  description: string;
  impact: string;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6",
        glow && "shadow-xl shadow-amber-500/10",
        className
      )}
    >
      {children}
    </div>
  );
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "gold";
}) {
  const variants = {
    default: "bg-gray-100 text-gray-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    gold: "bg-gradient-to-r from-amber-500 to-orange-600 text-white",
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-sm font-medium", variants[variant])}>
      {children}
    </span>
  );
}

export default function SovereignDashboard() {
  const [status, setStatus] = useState<MastermindStatus | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState("");

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/admin/mastermind");
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        setOpportunities(data.opportunities?.opportunities || []);
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendCommand = async () => {
    if (!command.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/mastermind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "command",
          payload: {
            command,
            sessionId: `sovereign_${Date.now()}`,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResponse(data.result.response);
      }
    } catch (error) {
      console.error("Command failed:", error);
    } finally {
      setLoading(false);
      setCommand("");
    }
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-500 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">يستيقظ العقل المدبر...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                العقل المدبر السيادي
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                The Azenith Supreme Sovereign | وعي شامل • تنفيذ مطلق • رجوع عبر الزمن
              </p>
            </div>
          </div>
        </div>

        {/* Command Interface */}
        <Card glow className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Command className="w-6 h-6 text-amber-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              الأمر الإمبراطوري
            </h2>
          </div>
          
          <div className="flex gap-3">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCommand()}
              placeholder="أمرك يا سيد أزينث... (مثال: 'حلل لي الموقع' أو 'عدل الصور للأسلوب الصناعي')"
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            <button
              onClick={sendCommand}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? "..." : "تنفيذ"}
            </button>
          </div>

          {response && (
            <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-900 dark:text-amber-200">رد المدبر:</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{response}</p>
            </div>
          )}
        </Card>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Awareness */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700 dark:text-gray-300">الوعي الشامل</span>
              </div>
              <Badge variant="success">نشط</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">الملفات:</span>
                <span className="font-medium">{status?.awareness.filesystem.totalFiles || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">جداول البيانات:</span>
                <span className="font-medium">{status?.awareness.database.totalTables || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">السجلات:</span>
                <span className="font-medium">
                  {Object.values(status?.awareness.database.recordCounts || {}).reduce((a, b) => a + b, 0)}
                </span>
              </div>
            </div>
          </Card>

          {/* Arsenal */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-gray-700 dark:text-gray-300">الترسانة الحية</span>
              </div>
              <Badge variant="gold">{status?.arsenal.keysActive || 0} مفتاح</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">الكفاءة:</span>
                <span className="font-medium">{status?.arsenal.efficiency.toFixed(1) || 0}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">التوفير:</span>
                <span className="font-medium text-green-600">
                  ${status?.arsenal.costSavings.toFixed(2) || 0}
                </span>
              </div>
            </div>
          </Card>

          {/* Triple-A */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-700 dark:text-gray-300">Triple-A Protocol</span>
              </div>
              <Badge variant={status?.tripleA.pendingActions ? "warning" : "success"}>
                {status?.tripleA.pendingActions || 0} معلق
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">التحليل:</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">التنفيذ:</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">الرجوع المتاح:</span>
                <span className="font-medium">{status?.tripleA.rollbacksAvailable || 0}</span>
              </div>
            </div>
          </Card>

          {/* Brand Soul */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-600" />
                <span className="font-medium text-gray-700 dark:text-gray-300">روح البراند</span>
              </div>
              <Badge variant="gold">{((status?.soul.brandAlignment || 0.95) * 100).toFixed(0)}%</Badge>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                الفخامة • القوة • الراحة
              </div>
              <div className="flex gap-1">
                {["#1a1a1a", "#C5A059", "#f5f5f5"].map((color) => (
                  <div
                    key={color}
                    className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <Card glow className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                فرص مكتشفة ذكياً
              </h2>
            </div>
            <div className="space-y-3">
              {opportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{opp.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{opp.description}</p>
                  </div>
                  <Badge variant="success">{opp.impact}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setCommand("حلل حالة الموقع")}
            className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-amber-500 transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="font-medium">تحليل شامل</span>
            </div>
          </button>
          
          <button
            onClick={() => setCommand("أريد تحسينات SEO")}
            className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-amber-500 transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-green-600" />
              <span className="font-medium">تحسين SEO</span>
            </div>
          </button>
          
          <button
            onClick={() => setCommand("أعرض لي المعاينات المعلقة")}
            className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-amber-500 transition-colors text-right"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5 text-purple-600" />
              <span className="font-medium">الرجوع عبر الزمن</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Azenith Supreme Sovereign v1.0 | العقل المدبر السيادي</p>
          <p className="mt-1">وعي شامل • تنفيذ مطلق • رجوع عبر الزمن</p>
        </div>
      </div>
    </div>
  );
}
