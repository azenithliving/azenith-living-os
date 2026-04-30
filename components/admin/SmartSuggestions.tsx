"use client";

import { useState, useEffect } from "react";
import {
  Lightbulb,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Play,
  Loader2,
  RefreshCw,
  Sparkles,
  Shield,
  Database,
  Zap,
  FileText,
} from "lucide-react";

// Types
interface PlanStep {
  id: number;
  action: "sql" | "api" | "update_settings" | "send_notification" | "analyze";
  description: string;
  details: Record<string, unknown>;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
}

interface ExecutionPlan {
  title: string;
  description: string;
  steps: PlanStep[];
  estimatedRisk: "low" | "medium" | "high";
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  created_at: string;
  risk_level: string;
  proposed_plan?: ExecutionPlan;
  execution_result?: {
    status: string;
    results: Array<{ success: boolean; error?: string }>;
  };
}

export default function SmartSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "executed" | "rejected">("all");
  const [agentQuery, setAgentQuery] = useState("");
  const [agentResponse, setAgentResponse] = useState<string | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Fetch suggestions
  useEffect(() => {
    fetchSuggestions();
  }, [filter]);

  async function fetchSuggestions() {
    try {
      setLoading(true);
      const response = await fetch("/api/omnipotent?action=suggestions", {
        headers: {
          "X-Internal-Key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch suggestions");

      const data = await response.json();
      if (data.success) {
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading suggestions");
    } finally {
      setLoading(false);
    }
  }

  // Execute a suggestion
  async function executeSuggestion(id: string) {
    try {
      setExecutingId(id);
      const response = await fetch("/api/omnipotent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          action: "execute",
          suggestionId: id,
          userId: "admin", // Replace with actual user ID
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchSuggestions();
      } else {
        alert(`فشل التنفيذ: ${data.error}`);
      }
    } catch (err) {
      alert(`خطأ: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExecutingId(null);
    }
  }

  // Reject a suggestion
  async function rejectSuggestion(id: string) {
    try {
      setRejectingId(id);
      const response = await fetch("/api/omnipotent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          action: "reject",
          suggestionId: id,
          userId: "admin", // Replace with actual user ID
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchSuggestions();
      }
    } catch (err) {
      alert(`خطأ: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setRejectingId(null);
    }
  }

  // Query the agent
  async function queryAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!agentQuery.trim()) return;

    setAgentLoading(true);
    setAgentResponse(null);

    try {
      const response = await fetch("/api/omnipotent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({
          action: "query",
          query: agentQuery,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAgentResponse(data.response);
      } else {
        setAgentResponse(`خطأ: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      setAgentResponse(`خطأ: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setAgentLoading(false);
    }
  }

  // Get status icon
  function getStatusIcon(status: string) {
    switch (status) {
      case "pending":
        return <Clock className="w-5 h-5 text-amber-400" />;
      case "executed":
      case "approved":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case "failed":
        return <AlertTriangle className="w-5 h-5 text-rose-400" />;
      default:
        return <Clock className="w-5 h-5 text-white/40" />;
    }
  }

  // Get risk badge
  function getRiskBadge(level: string) {
    const colors = {
      low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      high: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    };

    const labels = {
      low: "خطر منخفض",
      medium: "خطر متوسط",
      high: "خطر مرتفع",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs border ${
          colors[level as keyof typeof colors] || colors.low
        }`}
      >
        {labels[level as keyof typeof labels] || level}
      </span>
    );
  }

  // Get action icon
  function getActionIcon(action: string) {
    switch (action) {
      case "sql":
        return <Database className="w-4 h-4" />;
      case "api":
        return <Zap className="w-4 h-4" />;
      case "update_settings":
        return <FileText className="w-4 h-4" />;
      case "analyze":
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  }

  const filteredSuggestions =
    filter === "all" ? suggestions : suggestions.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-[#C5A059]" />
            المقترحات الذكية
          </h2>
          <p className="text-sm text-white/60 mt-1">
            اقتراحات الوكيل الشامل لتحسين وإدارة النظام
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* Agent Query Interface */}
      <div className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-6">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C5A059]" />
          سؤال الوكيل الذكي
        </h3>
        <form onSubmit={queryAgent} className="flex gap-2">
          <input
            type="text"
            value={agentQuery}
            onChange={(e) => setAgentQuery(e.target.value)}
            placeholder="اسأل الوكيل مثلاً: 'كم عدد الجداول في قاعدة البيانات؟' أو 'حلل أداء الموقع'"
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059]/50"
          />
          <button
            type="submit"
            disabled={agentLoading || !agentQuery.trim()}
            className="px-6 py-2 rounded-lg bg-[#C5A059] text-[#1a1a1a] font-medium hover:bg-[#d8b56d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {agentLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                يفكر...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                إرسال
              </>
            )}
          </button>
        </form>
        {agentResponse && (
          <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-white/80 whitespace-pre-wrap">{agentResponse}</p>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
        {[
          { id: "all", label: "الكل", count: suggestions.length },
          { id: "pending", label: "معلقة", count: suggestions.filter((s) => s.status === "pending").length },
          { id: "executed", label: "منفذة", count: suggestions.filter((s) => s.status === "executed").length },
          { id: "rejected", label: "مرفوضة", count: suggestions.filter((s) => s.status === "rejected").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab.id
                ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab.label}
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                filter === tab.id ? "bg-[#C5A059]/30 text-[#C5A059]" : "bg-white/10 text-white/50"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p className="text-rose-400">{error}</p>
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center">
          <Lightbulb className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">لا توجد اقتراحات {filter !== "all" ? "في هذا القسم" : ""}</p>
          <p className="text-sm text-white/30 mt-2">
            سيتم إنشاء اقتراحات تلقائياً كل 6 ساعات أو عند طلبك
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-4 flex items-start gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
              >
                {getStatusIcon(suggestion.status)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-medium text-white">{suggestion.title}</h3>
                    {getRiskBadge(suggestion.risk_level)}
                  </div>
                  <p className="text-sm text-white/60 line-clamp-2">{suggestion.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                    <span>{new Date(suggestion.created_at).toLocaleDateString("ar-SA")}</span>
                    <span className="capitalize">{suggestion.status}</span>
                  </div>
                </div>
                <button className="text-white/40 hover:text-white transition-colors">
                  {expandedId === suggestion.id ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Expanded Content */}
              {expandedId === suggestion.id && (
                <div className="border-t border-white/10 p-4">
                  {/* Plan Steps */}
                  {suggestion.proposed_plan && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-white/80 mb-3">خطة التنفيذ:</h4>
                      <div className="space-y-2">
                        {suggestion.proposed_plan.steps.map((step) => (
                          <div
                            key={step.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-white/5"
                          >
                            <div className="text-[#C5A059]">{getActionIcon(step.action)}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-white">{step.description}</span>
                                {step.requiresApproval && (
                                  <Shield className="w-4 h-4 text-amber-400" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-white/40">
                                <span className="uppercase">{step.action}</span>
                                <span>•</span>
                                <span className="capitalize">{step.riskLevel} risk</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Results */}
                  {suggestion.execution_result && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5">
                      <h4 className="text-sm font-medium text-white/80 mb-2">نتيجة التنفيذ:</h4>
                      <div className="space-y-1">
                        {suggestion.execution_result.results.map((result, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {result.success ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400" />
                            )}
                            <span className={result.success ? "text-emerald-400" : "text-rose-400"}>
                              {result.success ? "تم بنجاح" : result.error || "فشل"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {suggestion.status === "pending" && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => executeSuggestion(suggestion.id)}
                        disabled={executingId === suggestion.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {executingId === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {executingId === suggestion.id ? "جاري التنفيذ..." : "نفذ الخطة"}
                      </button>
                      <button
                        onClick={() => rejectSuggestion(suggestion.id)}
                        disabled={rejectingId === suggestion.id}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        {rejectingId === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
