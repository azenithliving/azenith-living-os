"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Crown,
  Loader2,
  Send,
  Sparkles,
  User,
  Zap,
  ClipboardCheck,
  Search,
  SlidersHorizontal,
  ChevronDown,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { SovereignMindPanel } from "@/components/admin/SovereignMindPanel";
import { AssistantBrowserCopilot } from "@/components/admin/AssistantBrowserCopilot";
import type { ResultAction } from "@/lib/admin-result-actions";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: string;
  actions?: ResultAction[];
};

type ActivityStep = {
  id: string;
  label: string;
  status: "waiting" | "running" | "done" | "failed";
};

type ExecutionRow = {
  id: string;
  execution_type: string;
  execution_status: string;
  execution_data: Record<string, unknown>;
  started_at: string;
  execution_time_ms: number | null;
};

type CapabilityAudit = {
  total: number;
  productionReady: boolean;
  byStatus: {
    ready: number;
    needs_approval: number;
    needs_dependency: number;
    needs_verification: number;
    not_ready: number;
  };
  byOperationalTier: {
    autonomous: number;
    approval_required: number;
    blocked: number;
  };
  averageReadiness: number;
  averageTrust: number;
  verificationCoverage: number;
  byTestStatus: {
    passed: number;
    protected: number;
    failed: number;
  };
  gaps: Array<{ capabilityId: string; gap: string }>;
  capabilities: Array<{
    id: string;
    label: string;
    status: string;
    operationalTier: string;
    executionMode: string;
    readinessScore: number;
    trustScore: number;
    testStatus: string;
    testSummary: string;
    evidenceExamples: string[];
    suggestedPrompt: string;
  }>;
};

type CapabilityFilter = "all" | "autonomous" | "approval_required" | "blocked";
type EvidenceFilter = "all" | "verified_success" | "approval_pending" | "failed" | "unverified";

type EvidenceLedger = {
  total: number;
  averageConfidence: number;
  byOutcome: {
    verified_success: number;
    approval_pending: number;
    failed: number;
    unverified: number;
  };
  items: Array<{
    id: string;
    tool: string;
    outcome: string;
    confidence: number;
    summary: string;
    proof: string[];
    startedAt: string;
    durationMs: number | null;
  }>;
};

export function UnifiedAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "أهلاً بيك في المساعد الموحّد. اتكلم عادي — هفهم المطلوب وأنفّذه من غير أوامر تقنية.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [capabilityAudit, setCapabilityAudit] = useState<CapabilityAudit | null>(null);
  const [evidenceLedger, setEvidenceLedger] = useState<EvidenceLedger | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  const [capabilitySearch, setCapabilitySearch] = useState("");
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [agentsLabel, setAgentsLabel] = useState("جاري التحقق...");
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [browserAutoOpenSignal, setBrowserAutoOpenSignal] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function requestNeedsLiveBrowser(text: string) {
    return /متصفح|تصفح|browser|استخدم.*المتصفح|ابحث|بحث|اتعلم|تعلم|استكشف|ai agents?|ذكاءات|موقع|رابط|https?:\/\//i.test(
      text
    );
  }

  function setStepStatus(id: string, status: ActivityStep["status"]) {
    setActivitySteps((steps) =>
      steps.map((step) => (step.id === id ? { ...step, status } : step))
    );
  }

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assistant");
      if (!res.ok) return;
      const data = await res.json();
      if (data.executions) setExecutions(data.executions);
      if (data.capabilityAudit) setCapabilityAudit(data.capabilityAudit);
      if (data.evidenceLedger) setEvidenceLedger(data.evidenceLedger);
      if (data.agents?.status === "READY") {
        setAgentsLabel(
          data.agents.mode === "cloud"
            ? "الوكلاء السحابيون — جاهز"
            : "نظام الوكلاء — متصل"
        );
      } else {
        setAgentsLabel("الوكلاء — غير متصل");
      }
      if (Array.isArray(data.history) && data.history.length > 0) {
        const restored: ChatMessage[] = data.history
          .filter(
            (h: { role: string }) => h.role === "user" || h.role === "assistant"
          )
          .map(
            (h: {
              role: string;
              content: string;
              command_executed?: string;
            }) => ({
              id: crypto.randomUUID(),
              role: h.role === "user" ? "user" : "assistant",
              content: h.content,
              tool: h.command_executed,
            })
          );
        if (restored.length > 0) {
          setMessages((prev) => [prev[0], ...restored.slice(-24)]);
        }
      }
    } catch {
      setAgentsLabel("تعذر تحميل الحالة");
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    if (requestNeedsLiveBrowser(trimmed)) {
      setBrowserAutoOpenSignal((value) => value + 1);
    }
    setActivitySteps([
      { id: "receive", label: "استلام الطلب", status: "running" },
      { id: "understand", label: "فهم النية واختيار القدرة", status: "waiting" },
      { id: "execute", label: "تنفيذ الأداة أو تجهيز طلب الموافقة", status: "waiting" },
      { id: "record", label: "تسجيل الدليل وتجهيز النتيجة", status: "waiting" },
    ]);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    try {
      setStepStatus("receive", "done");
      setStepStatus("understand", "running");
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      setStepStatus("understand", "done");
      setStepStatus("execute", "running");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      if (
        data.command?.name === "browser_research" ||
        /browserAugmentation|طبقة المتصفح|المتصفح الحي/i.test(String(data.reply || ""))
      ) {
        setBrowserAutoOpenSignal((value) => value + 1);
      }
      setStepStatus("execute", "done");
      setStepStatus("record", "running");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "تمت المعالجة.",
          tool: data.command?.name,
          actions: Array.isArray(data.actions) ? data.actions : [],
        },
      ]);
      await loadContext();
      setStepStatus("record", "done");
    } catch (err) {
      setActivitySteps((steps) =>
        steps.map((step) =>
          step.status === "running" || step.status === "waiting"
            ? { ...step, status: "failed" }
            : step
        )
      );
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            err instanceof Error ? `⚠️ ${err.message}` : "حصل خطأ — جرّب تاني.",
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => setActivitySteps([]), 1800);
    }
  }

  function runSelfTest() {
    if (!capabilityAudit) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "تقرير القدرات لم يكتمل تحميله بعد. سأعيد فحص الحالة الآن.",
          tool: "capability_self_test",
        },
      ]);
      void loadContext();
      return;
    }

    const preview = capabilityAudit.capabilities
      .slice(0, 6)
      .map((cap) => `• ${cap.label}: ${cap.status} | الدليل: ${cap.evidenceExamples[0] || "سجل تنفيذ"}`)
      .join("\n");

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          `تقرير الاختبار الذاتي:\n` +
          `• إجمالي القدرات: ${capabilityAudit.total}\n` +
          `• جاهزة فوراً: ${capabilityAudit.byStatus.ready}\n` +
          `• تحتاج موافقة: ${capabilityAudit.byStatus.needs_approval}\n` +
          `• فجوات حرجة: ${capabilityAudit.gaps.length}\n` +
          `• متوسط الجاهزية: ${capabilityAudit.averageReadiness}%\n` +
          `• متوسط الثقة: ${capabilityAudit.averageTrust}%\n` +
          `• تغطية التحقق: ${capabilityAudit.verificationCoverage}%\n` +
          `• اختبارات آمنة ناجحة: ${capabilityAudit.byTestStatus.passed}\n` +
          `• قدرات محمية بالموافقة: ${capabilityAudit.byTestStatus.protected}\n` +
          `• الحالة العامة: ${capabilityAudit.productionReady ? "موثقة وقابلة للقياس" : "تحتاج إغلاق فجوات"}\n\n` +
          preview,
        tool: "capability_self_test",
      },
    ]);
  }

  const filteredCapabilities = useMemo(() => {
    const query = capabilitySearch.trim().toLowerCase();
    return (capabilityAudit?.capabilities || [])
      .filter((capability) =>
        capabilityFilter === "all" ? true : capability.operationalTier === capabilityFilter
      )
      .filter((capability) =>
        query
          ? `${capability.label} ${capability.id} ${capability.executionMode}`
              .toLowerCase()
              .includes(query)
          : true
      );
  }, [capabilityAudit?.capabilities, capabilityFilter, capabilitySearch]);

  const capabilityFilterOptions: Array<{ value: CapabilityFilter; label: string }> = [
    { value: "all", label: "الكل" },
    { value: "autonomous", label: "تلقائي" },
    { value: "approval_required", label: "بموافقة" },
    { value: "blocked", label: "متوقف" },
  ];

  const evidenceFilterOptions: Array<{ value: EvidenceFilter; label: string }> = [
    { value: "all", label: "الكل" },
    { value: "verified_success", label: "موثق" },
    { value: "approval_pending", label: "موافقة" },
    { value: "failed", label: "فشل" },
    { value: "unverified", label: "غير مؤكد" },
  ];

  const filteredEvidence = useMemo(() => {
    const query = evidenceSearch.trim().toLowerCase();
    return (evidenceLedger?.items || [])
      .filter((item) => (evidenceFilter === "all" ? true : item.outcome === evidenceFilter))
      .filter((item) =>
        query
          ? `${item.tool} ${item.summary} ${item.proof.join(" ")}`.toLowerCase().includes(query)
          : true
      );
  }, [evidenceFilter, evidenceLedger?.items, evidenceSearch]);

  const outcomeLabel = (outcome: string) => {
    if (outcome === "verified_success") return "موثق";
    if (outcome === "approval_pending") return "موافقة";
    if (outcome === "failed") return "فشل";
    return "غير مؤكد";
  };

  const outcomeClass = (outcome: string) => {
    if (outcome === "verified_success") return "text-emerald-300";
    if (outcome === "approval_pending") return "text-[#C5A059]";
    if (outcome === "failed") return "text-red-300";
    return "text-amber-300";
  };

  function runCapabilityPrompt(prompt: string) {
    setCapabilitiesOpen(false);
    void sendMessage(prompt);
  }

  function sendEvidenceToChat(item: EvidenceLedger["items"][number]) {
    setEvidenceOpen(false);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        tool: "evidence_ledger",
        content:
          `سجل دليل التنفيذ:\n` +
          `• الأداة: ${item.tool}\n` +
          `• الحالة: ${outcomeLabel(item.outcome)}\n` +
          `• الثقة: ${item.confidence}%\n` +
          `• الملخص: ${item.summary}\n` +
          `• الدليل: ${(item.proof || []).join(" | ") || "execution log"}\n` +
          `• الوقت: ${new Date(item.startedAt).toLocaleString("ar-EG")}`,
      },
    ]);
  }

  const stepTone = (status: ActivityStep["status"]) => {
    if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    if (status === "running") return "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#e8d5a8]";
    if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-200";
    return "border-white/10 bg-white/[0.03] text-white/40";
  };

  return (
    <div className="min-h-full bg-[#0A0A0A] text-white" dir="rtl">
      <div className="max-w-7xl mx-auto p-4 md:p-6 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
              <Crown className="w-6 h-6 text-[#1a1a1a]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">المساعد الموحّد</h1>
              <p className="text-xs text-white/50">كل قدرات الموقع — مكان واحد</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            <Zap className="w-3.5 h-3.5" />
            {agentsLabel}
          </div>
        </header>
        <div className="relative flex flex-col gap-2 md:flex-row">
          <AssistantBrowserCopilot
            autoOpenSignal={browserAutoOpenSignal}
            assistantMessages={messages}
            assistantBusy={loading}
            onSendMessage={sendMessage}
          />
          <button
            type="button"
            onClick={() => {
              setCapabilitiesOpen((value) => !value);
              setEvidenceOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/10 px-4 py-3 text-sm hover:border-[#C5A059]/70 md:w-auto"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ClipboardCheck className="w-4 h-4 text-[#C5A059]" />
              كل القدرات
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                {capabilityAudit?.total ?? "..."} قدرة
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 text-[#C5A059] transition-transform ${capabilitiesOpen ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEvidenceOpen((value) => !value);
              setCapabilitiesOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:border-[#C5A059]/50 md:w-auto"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 text-[#C5A059]" />
              سجل الأدلة
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
                {evidenceLedger?.total ?? 0} عملية
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 text-[#C5A059] transition-transform ${evidenceOpen ? "rotate-180" : ""}`} />
          </button>

          {capabilitiesOpen && (
            <div className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/40 md:w-[760px]">
              <div className="border-b border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center md:grid-cols-6">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <p className="text-base font-bold text-white">{capabilityAudit?.total ?? "..."}</p>
                    <p className="text-[10px] text-white/40">قدرة</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                    <p className="text-base font-bold text-emerald-300">{capabilityAudit?.byStatus.ready ?? "..."}</p>
                    <p className="text-[10px] text-emerald-200/60">جاهزة</p>
                  </div>
                  <div className="rounded-xl border border-[#C5A059]/20 bg-[#C5A059]/10 p-2">
                    <p className="text-base font-bold text-[#C5A059]">{capabilityAudit?.byStatus.needs_approval ?? "..."}</p>
                    <p className="text-[10px] text-[#C5A059]/70">بموافقة</p>
                  </div>
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2">
                    <p className="text-base font-bold text-cyan-200">{capabilityAudit?.averageReadiness ?? "..."}%</p>
                    <p className="text-[10px] text-cyan-100/60">جاهزية</p>
                  </div>
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2">
                    <p className="text-base font-bold text-violet-200">{capabilityAudit?.averageTrust ?? "..."}%</p>
                    <p className="text-[10px] text-violet-100/60">ثقة</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <p className="text-base font-bold text-white">{capabilityAudit?.verificationCoverage ?? "..."}%</p>
                    <p className="text-[10px] text-white/40">تحقق</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-white/40" />
                    <input
                      value={capabilitySearch}
                      onChange={(event) => setCapabilitySearch(event.target.value)}
                      placeholder="ابحث عن قدرة..."
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/30"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={runSelfTest}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 px-3 py-2 text-xs text-[#C5A059] disabled:opacity-50"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    اختبر نفسك
                  </button>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-white/40" />
                  {capabilityFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCapabilityFilter(option.value)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${
                        capabilityFilter === option.value
                          ? "border-[#C5A059]/70 bg-[#C5A059]/15 text-[#C5A059]"
                          : "border-white/10 bg-white/[0.03] text-white/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <span className="mr-auto shrink-0 text-[10px] text-white/40">
                    ظاهر {filteredCapabilities.length} من {capabilityAudit?.total ?? 0}
                  </span>
                </div>
              </div>

              <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
                {filteredCapabilities.map((cap) => (
                  <button
                    key={cap.id}
                    type="button"
                    disabled={loading}
                    onClick={() => runCapabilityPrompt(cap.suggestedPrompt || `شغّل ${cap.label}`)}
                    className="block w-full rounded-xl border border-white/5 bg-white/[0.03] p-3 text-right text-xs hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{cap.label}</span>
                      <span className={cap.operationalTier === "autonomous" ? "text-emerald-300" : cap.operationalTier === "blocked" ? "text-red-300" : "text-[#C5A059]"}>
                        {cap.operationalTier === "autonomous" ? "تلقائي" : cap.operationalTier === "blocked" ? "متوقف" : "موافقة"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/45 md:grid-cols-4">
                      <span>جاهزية {cap.readinessScore}%</span>
                      <span>ثقة {cap.trustScore}%</span>
                      <span>الدليل: {cap.evidenceExamples[0]}</span>
                      <span className={cap.testStatus === "passed" ? "text-emerald-300" : cap.testStatus === "protected" ? "text-[#C5A059]" : "text-red-300"}>
                        {cap.testStatus === "passed" ? "اختبار ناجح" : cap.testStatus === "protected" ? "محمي بالموافقة" : "فشل"}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[10px] text-white/35">سيُرسل للشات: {cap.suggestedPrompt}</p>
                  </button>
                ))}
                {capabilityAudit && filteredCapabilities.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-white/40">
                    لا توجد قدرات مطابقة لهذا البحث.
                  </p>
                )}
              </div>
            </div>
          )}

          {evidenceOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/40 md:w-[760px]">
              <div className="border-b border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center md:grid-cols-5">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <p className="text-base font-bold text-white">{evidenceLedger?.total ?? 0}</p>
                    <p className="text-[10px] text-white/40">عملية</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2">
                    <p className="text-base font-bold text-emerald-300">{evidenceLedger?.byOutcome.verified_success ?? 0}</p>
                    <p className="text-[10px] text-emerald-100/60">موثق</p>
                  </div>
                  <div className="rounded-xl border border-[#C5A059]/20 bg-[#C5A059]/10 p-2">
                    <p className="text-base font-bold text-[#C5A059]">{evidenceLedger?.byOutcome.approval_pending ?? 0}</p>
                    <p className="text-[10px] text-[#C5A059]/70">موافقة</p>
                  </div>
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2">
                    <p className="text-base font-bold text-red-300">{evidenceLedger?.byOutcome.failed ?? 0}</p>
                    <p className="text-[10px] text-red-100/60">فشل</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <p className="text-base font-bold text-white">{evidenceLedger?.averageConfidence ?? 0}%</p>
                    <p className="text-[10px] text-white/40">ثقة</p>
                  </div>
                </div>
                <p className="rounded-xl border border-[#C5A059]/20 bg-[#C5A059]/10 p-3 text-xs text-[#e8d5a8]">
                  استخدمه لما تحب تتأكد: هل المساعد نفذ فعلاً؟ أين الدليل؟ ماذا فشل؟ وما الذي توقف للموافقة؟
                </p>
                <div className="flex flex-col gap-2 md:flex-row">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <Search className="w-3.5 h-3.5 text-white/40" />
                    <input
                      value={evidenceSearch}
                      onChange={(event) => setEvidenceSearch(event.target.value)}
                      placeholder="ابحث في الأدلة..."
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadContext()}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65 hover:border-[#C5A059]/40"
                  >
                    تحديث السجل
                  </button>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-white/40" />
                  {evidenceFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setEvidenceFilter(option.value)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${
                        evidenceFilter === option.value
                          ? "border-[#C5A059]/70 bg-[#C5A059]/15 text-[#C5A059]"
                          : "border-white/10 bg-white/[0.03] text-white/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                  <span className="mr-auto shrink-0 text-[10px] text-white/40">
                    ظاهر {filteredEvidence.length} من {evidenceLedger?.total ?? 0}
                  </span>
                </div>
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3 space-y-2">
                {filteredEvidence.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => sendEvidenceToChat(item)}
                    className="block w-full rounded-xl border border-white/5 bg-white/[0.03] p-3 text-right text-xs hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[#C5A059]">{item.tool}</span>
                      <span className={outcomeClass(item.outcome)}>{outcomeLabel(item.outcome)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-white/65">{item.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/40">
                      <span>ثقة {item.confidence}%</span>
                      <span>الدليل: {item.proof[0] || "execution log"}</span>
                      <span>{new Date(item.startedAt).toLocaleString("ar-EG")}</span>
                    </div>
                    <p className="mt-2 text-[10px] text-white/35">اضغط لعرض هذا الدليل داخل الشات.</p>
                  </button>
                ))}
                {filteredEvidence.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-white/40">
                    لا توجد أدلة مطابقة. نفّذ قدرة أو حدّث السجل.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
          <div className="lg:col-span-8 flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden min-h-[420px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-lg ${msg.role === "user" ? "bg-[#C5A059] text-[#1a1a1a]" : "bg-white/10"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-[#C5A059]" />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-[#C5A059]/15 border border-[#C5A059]/30" : "bg-white/[0.04] border border-white/10"}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.tool && <p className="mt-2 text-[10px] text-[#C5A059]/80 font-mono">أداة: {msg.tool}</p>}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((action) => (
                          <a
                            key={`${action.label}-${action.href}`}
                            href={action.href}
                            target={action.kind === "external" ? "_blank" : undefined}
                            rel={action.kind === "external" ? "noreferrer" : undefined}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#C5A059]/35 bg-[#C5A059]/15 px-3 py-1.5 text-[11px] font-medium text-[#f0dca8] hover:border-[#C5A059]/70"
                          >
                            {action.label}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {activitySteps.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                    <Zap className="h-3.5 w-3.5 text-[#C5A059]" />
                    تنفيذ مباشر
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {activitySteps.map((step) => (
                      <div
                        key={step.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${stepTone(step.status)}`}
                      >
                        {step.status === "running" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : step.status === "done" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-current opacity-60" />
                        )}
                        {step.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
                  جاري التفكير والتنفيذ…
                </div>
              )}
              <div ref={scrollRef} />
            </div>
            <form className="p-4 border-t border-white/10" onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>
              <div className="flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} placeholder="اكتب طلبك هنا…" className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C5A059]/50" />
                <button type="submit" disabled={loading || !input.trim()} className="p-3 rounded-xl bg-[#C5A059] text-[#1a1a1a] disabled:opacity-40">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
          </div>
          <aside className="lg:col-span-4 flex flex-col gap-4 min-h-[280px]">
            <SovereignMindPanel />
          </aside>
        </div>
      </div>
    </div>
  );
}
