"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  ExternalLink,
  Loader2,
  Monitor,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  User,
  Users,
  Zap,
  ChevronDown,
} from "lucide-react";
import { SovereignMindPanel } from "@/components/admin/SovereignMindPanel";
import { AssistantBrowserCopilot } from "@/components/admin/AssistantBrowserCopilot";
import { ChatPanel } from "@/components/admin/agents/ChatPanel";
import type { ResultAction } from "@/lib/admin-result-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type UnifiedTab = "chat" | "browser" | "capabilities" | "evidence" | "mind" | "team";

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

type CapabilityFilter = "all" | "autonomous" | "approval_required" | "blocked";
type EvidenceFilter = "all" | "verified_success" | "approval_pending" | "failed" | "unverified";

type CapabilityAudit = {
  total: number;
  productionReady: boolean;
  byStatus: { ready: number; needs_approval: number; needs_dependency: number; needs_verification: number; not_ready: number };
  byOperationalTier: { autonomous: number; approval_required: number; blocked: number };
  averageReadiness: number;
  averageTrust: number;
  verificationCoverage: number;
  byTestStatus: { passed: number; protected: number; failed: number };
  gaps: Array<{ capabilityId: string; gap: string }>;
  capabilities: Array<{
    id: string; label: string; status: string; operationalTier: string;
    executionMode: string; readinessScore: number; trustScore: number;
    testStatus: string; testSummary: string; evidenceExamples: string[];
    suggestedPrompt: string;
  }>;
};

type EvidenceLedger = {
  total: number;
  averageConfidence: number;
  byOutcome: { verified_success: number; approval_pending: number; failed: number; unverified: number };
  items: Array<{
    id: string; tool: string; outcome: string; confidence: number;
    summary: string; proof: string[]; startedAt: string; durationMs: number | null;
  }>;
};

type AgentStatus = { agent: string; status: "online" | "busy" | "offline"; taskCount: number; recentActivity: string };

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS: Array<{ id: UnifiedTab; label: string; icon: React.ReactNode; color: string; activeColor: string }> = [
  { id: "chat",         label: "الشات",        icon: <Bot className="w-4 h-4" />,           color: "border-[#C5A059]/30 text-[#C5A059]",         activeColor: "bg-gradient-to-br from-[#C5A059] to-[#8B7355]" },
  { id: "browser",      label: "المتصفح الحي", icon: <Monitor className="w-4 h-4" />,        color: "border-cyan-400/30 text-cyan-300",            activeColor: "bg-gradient-to-br from-cyan-600 to-cyan-800" },
  { id: "capabilities", label: "كل القدرات",   icon: <ClipboardCheck className="w-4 h-4" />, color: "border-violet-400/30 text-violet-300",        activeColor: "bg-gradient-to-br from-violet-600 to-indigo-700" },
  { id: "evidence",     label: "سجل الأدلة",   icon: <Sparkles className="w-4 h-4" />,       color: "border-emerald-400/30 text-emerald-300",      activeColor: "bg-gradient-to-br from-emerald-600 to-teal-700" },
  { id: "mind",         label: "عقل النظام",   icon: <Brain className="w-4 h-4" />,          color: "border-amber-400/30 text-amber-300",          activeColor: "bg-gradient-to-br from-amber-600 to-orange-700" },
  { id: "team",         label: "الفريق",       icon: <Users className="w-4 h-4" />,          color: "border-purple-400/30 text-purple-300",        activeColor: "bg-gradient-to-br from-purple-600 to-indigo-700" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function outcomeLabel(outcome: string) {
  if (outcome === "verified_success") return "موثق";
  if (outcome === "approval_pending") return "موافقة";
  if (outcome === "failed") return "فشل";
  return "غير مؤكد";
}
function outcomeClass(outcome: string) {
  if (outcome === "verified_success") return "text-emerald-300";
  if (outcome === "approval_pending") return "text-[#C5A059]";
  if (outcome === "failed") return "text-red-300";
  return "text-amber-300";
}
function stepTone(status: ActivityStep["status"]) {
  if (status === "done")    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "running") return "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#e8d5a8]";
  if (status === "failed")  return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/[0.03] text-white/40";
}
function requestNeedsLiveBrowser(text: string) {
  return /متصفح|تصفح|browser|استخدم.*المتصفح|ابحث|بحث|اتعلم|تعلم|استكشف|ai agents?|ذكاءات|موقع|رابط|https?:\/\//i.test(text);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UnifiedAssistant() {
  const [activeTab, setActiveTab] = useState<UnifiedTab>("chat");

  // chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: "أهلاً بيك في المساعد الموحّد. اتكلم عادي — هفهم المطلوب وأنفّذه من غير أوامر تقنية." },
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [browserAutoOpenSignal, setBrowserAutoOpenSignal] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // context state
  const [capabilityAudit,  setCapabilityAudit]  = useState<CapabilityAudit | null>(null);
  const [evidenceLedger,   setEvidenceLedger]   = useState<EvidenceLedger | null>(null);
  const [agentsLabel,      setAgentsLabel]      = useState("جاري التحقق...");

  // capabilities tab
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter>("all");
  const [capabilitySearch, setCapabilitySearch] = useState("");

  // evidence tab
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [evidenceSearch, setEvidenceSearch] = useState("");

  // team tab
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});

  // ── load context ─────────────────────────────────────────────────────────
  const loadContext = useCallback(async () => {
    try {
      const res  = await fetch("/api/admin/assistant");
      if (!res.ok) return;
      const data = await res.json();
      if (data.capabilityAudit) setCapabilityAudit(data.capabilityAudit);
      if (data.evidenceLedger)  setEvidenceLedger(data.evidenceLedger);
      if (data.agents?.status === "READY") {
        setAgentsLabel(data.agents.mode === "cloud" ? "الوكلاء السحابيون — جاهز" : "نظام الوكلاء — متصل");
      } else {
        setAgentsLabel("الوكلاء — غير متصل");
      }
      if (Array.isArray(data.history) && data.history.length > 0) {
        const restored: ChatMessage[] = data.history
          .filter((h: { role: string }) => h.role === "user" || h.role === "assistant")
          .map((h: { role: string; content: string; command_executed?: string }) => ({
            id: crypto.randomUUID(),
            role: h.role === "user" ? "user" : "assistant",
            content: h.content,
            tool: h.command_executed,
          }));
        if (restored.length > 0) setMessages((prev) => [prev[0], ...restored.slice(-24)]);
      }
    } catch { setAgentsLabel("تعذر تحميل الحالة"); }
  }, []);

  useEffect(() => { loadContext(); }, [loadContext]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  // ── load team statuses ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "team") return;
    fetch("/api/admin/agents/chat")
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data) setAgentStatuses(d.data); })
      .catch(() => {});
    const iv = setInterval(() => {
      fetch("/api/admin/agents/chat")
        .then((r) => r.json())
        .then((d) => { if (d.success && d.data) setAgentStatuses(d.data); })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(iv);
  }, [activeTab]);

  // ── step helpers ──────────────────────────────────────────────────────────
  function setStepStatus(id: string, status: ActivityStep["status"]) {
    setActivitySteps((steps) => steps.map((s) => s.id === id ? { ...s, status } : s));
  }

  // ── send message ──────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setLoading(true);
    if (requestNeedsLiveBrowser(trimmed)) {
      setBrowserAutoOpenSignal((v) => v + 1);
      setActiveTab("browser");
    }
    setActivitySteps([
      { id: "receive",   label: "استلام الطلب",                         status: "running" },
      { id: "understand",label: "فهم النية واختيار القدرة",              status: "waiting" },
      { id: "execute",   label: "تنفيذ الأداة أو تجهيز طلب الموافقة",   status: "waiting" },
      { id: "record",    label: "تسجيل الدليل وتجهيز النتيجة",          status: "waiting" },
    ]);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: trimmed }]);
    try {
      setStepStatus("receive", "done");
      setStepStatus("understand", "running");
      const res  = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      setStepStatus("understand", "done");
      setStepStatus("execute", "running");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");
      if (data.command?.name === "browser_research" || /browserAugmentation|المتصفح الحي/i.test(String(data.reply || ""))) {
        setBrowserAutoOpenSignal((v) => v + 1);
      }
      setStepStatus("execute", "done");
      setStepStatus("record", "running");
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: data.reply || "تمت المعالجة.",
        tool: data.command?.name,
        actions: Array.isArray(data.actions) ? data.actions : [],
      }]);
      await loadContext();
      setStepStatus("record", "done");
    } catch (err) {
      setActivitySteps((steps) => steps.map((s) =>
        s.status === "running" || s.status === "waiting" ? { ...s, status: "failed" } : s
      ));
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: err instanceof Error ? `⚠️ ${err.message}` : "حصل خطأ — جرّب تاني.",
      }]);
    } finally {
      setLoading(false);
      window.setTimeout(() => setActivitySteps([]), 1800);
    }
  }

  // ── filtered capabilities ─────────────────────────────────────────────────
  const filteredCapabilities = useMemo(() => {
    const q = capabilitySearch.trim().toLowerCase();
    return (capabilityAudit?.capabilities || [])
      .filter((c) => capabilityFilter === "all" ? true : c.operationalTier === capabilityFilter)
      .filter((c) => q ? `${c.label} ${c.id} ${c.executionMode}`.toLowerCase().includes(q) : true);
  }, [capabilityAudit?.capabilities, capabilityFilter, capabilitySearch]);

  const filteredEvidence = useMemo(() => {
    const q = evidenceSearch.trim().toLowerCase();
    return (evidenceLedger?.items || [])
      .filter((i) => evidenceFilter === "all" ? true : i.outcome === evidenceFilter)
      .filter((i) => q ? `${i.tool} ${i.summary} ${i.proof.join(" ")}`.toLowerCase().includes(q) : true);
  }, [evidenceFilter, evidenceLedger?.items, evidenceSearch]);

  // ── self test ─────────────────────────────────────────────────────────────
  function runSelfTest() {
    if (!capabilityAudit) { void loadContext(); return; }
    const preview = capabilityAudit.capabilities.slice(0, 6)
      .map((c) => `• ${c.label}: ${c.status} | الدليل: ${c.evidenceExamples[0] || "سجل تنفيذ"}`).join("\n");
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), role: "assistant", tool: "capability_self_test",
      content:
        `تقرير الاختبار الذاتي:\n` +
        `• إجمالي القدرات: ${capabilityAudit.total}\n` +
        `• جاهزة فوراً: ${capabilityAudit.byStatus.ready}\n` +
        `• تحتاج موافقة: ${capabilityAudit.byStatus.needs_approval}\n` +
        `• فجوات حرجة: ${capabilityAudit.gaps.length}\n` +
        `• متوسط الجاهزية: ${capabilityAudit.averageReadiness}%\n` +
        `• متوسط الثقة: ${capabilityAudit.averageTrust}%\n` +
        `• تغطية التحقق: ${capabilityAudit.verificationCoverage}%\n` +
        `• الحالة العامة: ${capabilityAudit.productionReady ? "موثقة وقابلة للقياس" : "تحتاج إغلاق فجوات"}\n\n` +
        preview,
    }]);
    setActiveTab("chat");
  }

  function sendEvidenceToChat(item: EvidenceLedger["items"][number]) {
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(), role: "assistant", tool: "evidence_ledger",
      content:
        `سجل دليل التنفيذ:\n• الأداة: ${item.tool}\n• الحالة: ${outcomeLabel(item.outcome)}\n` +
        `• الثقة: ${item.confidence}%\n• الملخص: ${item.summary}\n` +
        `• الدليل: ${(item.proof || []).join(" | ") || "execution log"}\n` +
        `• الوقت: ${new Date(item.startedAt).toLocaleString("ar-EG")}`,
    }]);
    setActiveTab("chat");
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col" dir="rtl">

      {/* ── Header ── */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl shadow-lg">
            <Crown className="w-6 h-6 text-[#1a1a1a]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">المساعد الموحّد</h1>
            <p className="text-xs text-white/40">كل قدرات الموقع — مكان واحد</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
          {agentsLabel}
        </div>
      </header>

      {/* ── Tab Bar ── */}
      <nav className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-[#C5A059] text-white bg-white/[0.04]"
                : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
            }`}
          >
            <span className={activeTab === tab.id ? "text-[#C5A059]" : ""}>{tab.icon}</span>
            {tab.label}
            {tab.id === "capabilities" && capabilityAudit && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                {capabilityAudit.total}
              </span>
            )}
            {tab.id === "evidence" && evidenceLedger && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
                {evidenceLedger.total}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* ════════ TAB: CHAT ════════ */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[calc(100vh-160px)]">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-lg shrink-0 ${msg.role === "user" ? "bg-[#C5A059] text-[#1a1a1a]" : "bg-white/10"}`}>
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-[#C5A059]" />}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-[#C5A059]/15 border border-[#C5A059]/30"
                      : "bg-white/[0.04] border border-white/10"
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    {msg.tool && (
                      <p className="mt-2 text-[10px] text-[#C5A059]/80 font-mono">أداة: {msg.tool}</p>
                    )}
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

              {/* activity steps */}
              {activitySteps.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white">
                    <Zap className="h-3.5 w-3.5 text-[#C5A059]" />
                    تنفيذ مباشر
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {activitySteps.map((step) => (
                      <div key={step.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] ${stepTone(step.status)}`}>
                        {step.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : step.status === "done"  ? <CheckCircle2 className="h-3.5 w-3.5" />
                          : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
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

            <form
              className="p-4 border-t border-white/10 bg-[#0A0A0A]"
              onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
            >
              <div className="flex gap-2 max-w-4xl mx-auto">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  placeholder="اكتب طلبك هنا…"
                  className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#C5A059]/50 placeholder:text-white/30"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="p-3 rounded-xl bg-[#C5A059] text-[#1a1a1a] disabled:opacity-40 hover:bg-[#d4b06a] transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ════════ TAB: BROWSER ════════ */}
        {activeTab === "browser" && (
          <div className="h-[calc(100vh-160px)] overflow-hidden p-4">
            <AssistantBrowserCopilot
              autoOpenSignal={browserAutoOpenSignal}
              assistantMessages={messages}
              assistantBusy={loading}
              onSendMessage={(msg) => { void sendMessage(msg); setActiveTab("chat"); }}
              fullPage
            />
          </div>
        )}

        {/* ════════ TAB: CAPABILITIES ════════ */}
        {activeTab === "capabilities" && (
          <div className="h-[calc(100vh-160px)] overflow-y-auto p-4 md:p-6 space-y-4">
            {/* stats row */}
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {[
                { label: "قدرة",     value: capabilityAudit?.total,                    color: "border-white/10 text-white" },
                { label: "جاهزة",    value: capabilityAudit?.byStatus.ready,            color: "border-emerald-500/20 text-emerald-300" },
                { label: "بموافقة",  value: capabilityAudit?.byStatus.needs_approval,   color: "border-[#C5A059]/20 text-[#C5A059]" },
                { label: "جاهزية",  value: capabilityAudit ? `${capabilityAudit.averageReadiness}%` : "…", color: "border-cyan-500/20 text-cyan-300" },
                { label: "ثقة",     value: capabilityAudit ? `${capabilityAudit.averageTrust}%` : "…",     color: "border-violet-500/20 text-violet-300" },
                { label: "تحقق",    value: capabilityAudit ? `${capabilityAudit.verificationCoverage}%` : "…", color: "border-white/10 text-white" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border bg-white/[0.03] p-3 text-center ${s.color}`}>
                  <p className="text-base font-bold">{s.value ?? "…"}</p>
                  <p className="text-[10px] opacity-60">{s.label}</p>
                </div>
              ))}
            </div>

            {/* search + filter */}
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Search className="w-3.5 h-3.5 text-white/40" />
                <input
                  value={capabilitySearch}
                  onChange={(e) => setCapabilitySearch(e.target.value)}
                  placeholder="ابحث عن قدرة…"
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
              {(["all","autonomous","approval_required","blocked"] as CapabilityFilter[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCapabilityFilter(v)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${
                    capabilityFilter === v
                      ? "border-[#C5A059]/70 bg-[#C5A059]/15 text-[#C5A059]"
                      : "border-white/10 bg-white/[0.03] text-white/50"
                  }`}
                >
                  {v === "all" ? "الكل" : v === "autonomous" ? "تلقائي" : v === "approval_required" ? "بموافقة" : "متوقف"}
                </button>
              ))}
              <span className="mr-auto shrink-0 text-[10px] text-white/40">
                {filteredCapabilities.length} من {capabilityAudit?.total ?? 0}
              </span>
            </div>

            {/* capability cards */}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredCapabilities.map((cap) => (
                <button
                  key={cap.id}
                  type="button"
                  disabled={loading}
                  onClick={() => { void sendMessage(cap.suggestedPrompt || `شغّل ${cap.label}`); setActiveTab("chat"); }}
                  className="block rounded-xl border border-white/5 bg-white/[0.03] p-3 text-right text-xs hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 disabled:opacity-50 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{cap.label}</span>
                    <span className={cap.operationalTier === "autonomous" ? "text-emerald-300" : cap.operationalTier === "blocked" ? "text-red-300" : "text-[#C5A059]"}>
                      {cap.operationalTier === "autonomous" ? "تلقائي" : cap.operationalTier === "blocked" ? "متوقف" : "موافقة"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-white/45">
                    <span>جاهزية {cap.readinessScore}%</span>
                    <span>ثقة {cap.trustScore}%</span>
                    <span>الدليل: {cap.evidenceExamples[0]}</span>
                    <span className={cap.testStatus === "passed" ? "text-emerald-300" : cap.testStatus === "protected" ? "text-[#C5A059]" : "text-red-300"}>
                      {cap.testStatus === "passed" ? "اختبار ناجح" : cap.testStatus === "protected" ? "محمي" : "فشل"}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-[10px] text-white/30">اضغط لتشغيل: {cap.suggestedPrompt}</p>
                </button>
              ))}
              {capabilityAudit && filteredCapabilities.length === 0 && (
                <p className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-white/40">
                  لا توجد قدرات مطابقة.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: EVIDENCE ════════ */}
        {activeTab === "evidence" && (
          <div className="h-[calc(100vh-160px)] overflow-y-auto p-4 md:p-6 space-y-4">
            {/* stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "عملية",  value: evidenceLedger?.total ?? 0,                         color: "border-white/10 text-white" },
                { label: "موثق",   value: evidenceLedger?.byOutcome.verified_success ?? 0,     color: "border-emerald-500/20 text-emerald-300" },
                { label: "موافقة", value: evidenceLedger?.byOutcome.approval_pending ?? 0,     color: "border-[#C5A059]/20 text-[#C5A059]" },
                { label: "فشل",    value: evidenceLedger?.byOutcome.failed ?? 0,               color: "border-red-500/20 text-red-300" },
                { label: "ثقة",    value: evidenceLedger ? `${evidenceLedger.averageConfidence}%` : "0%", color: "border-white/10 text-white" },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl border bg-white/[0.03] p-3 text-center ${s.color}`}>
                  <p className="text-base font-bold">{s.value}</p>
                  <p className="text-[10px] opacity-60">{s.label}</p>
                </div>
              ))}
            </div>

            <p className="rounded-xl border border-[#C5A059]/20 bg-[#C5A059]/10 p-3 text-xs text-[#e8d5a8]">
              استخدمه لما تحب تتأكد: هل المساعد نفذ فعلاً؟ أين الدليل؟ ماذا فشل؟ وما الذي توقف للموافقة؟
            </p>

            {/* search + filter */}
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Search className="w-3.5 h-3.5 text-white/40" />
                <input
                  value={evidenceSearch}
                  onChange={(e) => setEvidenceSearch(e.target.value)}
                  placeholder="ابحث في الأدلة…"
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
              {(["all","verified_success","approval_pending","failed","unverified"] as EvidenceFilter[]).map((v) => (
                <button key={v} type="button" onClick={() => setEvidenceFilter(v)}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${
                    evidenceFilter === v
                      ? "border-[#C5A059]/70 bg-[#C5A059]/15 text-[#C5A059]"
                      : "border-white/10 bg-white/[0.03] text-white/50"
                  }`}
                >
                  {v === "all" ? "الكل" : outcomeLabel(v)}
                </button>
              ))}
            </div>

            {/* evidence cards */}
            <div className="space-y-2">
              {filteredEvidence.map((item) => (
                <button key={item.id} type="button" onClick={() => sendEvidenceToChat(item)}
                  className="block w-full rounded-xl border border-white/5 bg-white/[0.03] p-3 text-right text-xs hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 transition-all"
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
                  <p className="mt-1 text-[10px] text-white/30">اضغط لعرض الدليل في الشات.</p>
                </button>
              ))}
              {filteredEvidence.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-xs text-white/40">
                  لا توجد أدلة مطابقة. نفّذ قدرة أو حدّث السجل.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: MIND ════════ */}
        {activeTab === "mind" && (
          <div className="h-[calc(100vh-160px)] overflow-y-auto p-4 md:p-6">
            <SovereignMindPanel />
          </div>
        )}

        {/* ════════ TAB: TEAM ════════ */}
        {activeTab === "team" && (
          <div className="h-[calc(100vh-160px)] overflow-y-auto p-4 md:p-6 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold mb-1">
                <Users className="w-4 h-4 text-[#C5A059]" />
                فريق الوكلاء — تكلم مع أي وكيل مباشرة
              </h2>
              <p className="text-xs text-white/40">
                PRIME وVanguard هما جزء من المساعد الموحّد. يمكنك توجيه مهام متخصصة لكل منهما من هنا.
              </p>
            </div>

            {/* agent status cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "prime",    name: "PRIME",    role: "مهندس التصميم والتطوير",  color: "purple"  as const },
                { key: "vanguard", name: "Vanguard", role: "مدير العمليات والمبيعات", color: "emerald" as const },
              ].map((agent) => {
                const st = agentStatuses[agent.key];
                const dotColor =
                  st?.status === "online"  ? "bg-emerald-500" :
                  st?.status === "busy"    ? "bg-amber-500 animate-pulse" :
                  "bg-white/20";
                const statusText =
                  st?.status === "online"  ? "متاح" :
                  st?.status === "busy"    ? "مشغول" :
                  st?.status === "offline" ? "غير متاح" : "جاري التحقق…";
                const borderColor = agent.color === "purple" ? "border-purple-500/25" : "border-emerald-500/25";

                return (
                  <div key={agent.key} className={`rounded-2xl border ${borderColor} bg-white/[0.02] overflow-hidden`}>
                    {/* agent header */}
                    <div className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      agent.color === "purple" ? "bg-purple-500/10" : "bg-emerald-500/10"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{agent.key === "prime" ? "🧠" : "💼"}</span>
                        <div>
                          <p className="font-bold text-sm">{agent.name}</p>
                          <p className="text-[10px] text-white/40">{agent.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <span className="text-[10px] text-white/50">{statusText}</span>
                        {st?.taskCount !== undefined && (
                          <span className="text-[10px] text-white/30">· {st.taskCount} مهمة</span>
                        )}
                      </div>
                    </div>
                    {/* embedded chat */}
                    <div className="p-3">
                      <ChatPanel agentKey={agent.key} agentColor={agent.color} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* other agents info */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold text-white/60 mb-3">باقي فريق الوكلاء</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { key: "analyst",  name: "Analyst",  icon: "📊", role: "محلل البيانات",    color: "blue"   },
                  { key: "coder",    name: "Coder",    icon: "💻", role: "مطور الكود",        color: "cyan"   },
                  { key: "ops",      name: "Ops",      icon: "⚙️",  role: "مراقب العمليات",   color: "yellow" },
                  { key: "security", name: "Security", icon: "🛡️", role: "حارس الأمن",        color: "red"    },
                  { key: "learner",  name: "Learner",  icon: "🎓", role: "محرك التعلم",       color: "indigo" },
                ].map((a) => {
                  const st = agentStatuses[a.key];
                  return (
                    <div key={a.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
                      <span className="text-xl">{a.icon}</span>
                      <p className="text-xs font-bold mt-1">{a.name}</p>
                      <p className="text-[10px] text-white/40">{a.role}</p>
                      <div className={`mt-2 w-2 h-2 rounded-full mx-auto ${
                        st?.status === "online" ? "bg-emerald-500" :
                        st?.status === "busy"   ? "bg-amber-500 animate-pulse" :
                        "bg-white/20"
                      }`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>{/* end tab content */}
    </div>
  );
}
