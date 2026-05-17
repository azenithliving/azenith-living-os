"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Crown,
  Loader2,
  Send,
  Sparkles,
  User,
  Zap,
  Key,
  BarChart3,
  Shield,
  Wrench,
} from "lucide-react";
import { SovereignMindPanel } from "@/components/admin/SovereignMindPanel";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: string;
};

type ExecutionRow = {
  id: string;
  execution_type: string;
  execution_status: string;
  execution_data: Record<string, unknown>;
  started_at: string;
  execution_time_ms: number | null;
};

const QUICK_PROMPTS = [
  { label: "حالة المفاتيح", icon: Key, text: "ورّيني حالة كل مفاتيح الذكاء الاصطناعي" },
  { label: "زوار اليوم", icon: BarChart3, text: "كم عدد زوار الموقع آخر 7 أيام؟" },
  { label: "صحة النظام", icon: Shield, text: "هل الموقع شغال تمام؟ افحص صحة النظام" },
  {
    label: "مراجعة شاملة",
    icon: Wrench,
    text: "راجع الموقع واقترح أهم التحسينات للتحويل والأمان",
  },
  { label: "تحسين SEO", icon: Sparkles, text: "حلّل SEO للموقع واقترح تحسينات" },
  { label: "Genesis", icon: Zap, text: "كوّن قسماً ذهبياً جديداً للصفحة الرئيسية" },
];

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
  const [agentsLabel, setAgentsLabel] = useState("جاري التحقق...");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/assistant");
      if (!res.ok) return;
      const data = await res.json();
      if (data.executions) setExecutions(data.executions);
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
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الإرسال");

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "تمت المعالجة.",
          tool: data.command?.name,
        },
      ]);
      await loadContext();
    } catch (err) {
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
    }
  }

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
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(chip.text)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#C5A059]/40 text-xs disabled:opacity-50"
            >
              <chip.icon className="w-3.5 h-3.5 text-[#C5A059]" />
              {chip.label}
            </button>
          ))}
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
                  </div>
                </div>
              ))}
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
            <div className="flex flex-col flex-1 rounded-2xl border border-white/10 bg-white/[0.02] min-h-0">
            <div className="p-4 border-b border-white/10 flex items-center gap-2 text-sm font-bold">
              <Sparkles className="w-4 h-4 text-[#C5A059]" />
              سجل التنفيذ
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {executions.length === 0 && <p className="text-xs text-white/30 text-center py-8">سيظهر هنا كل ما نفّذه المساعد</p>}
              {executions.map((ex) => (
                <div key={ex.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-[#C5A059] font-mono truncate">{ex.execution_type.replace("assistant:", "")}</span>
                    <span className={ex.execution_status === "success" ? "text-emerald-400" : "text-amber-400"}>{ex.execution_status}</span>
                  </div>
                  <p className="text-white/40 line-clamp-2">{(ex.execution_data?.userMessage as string) || "—"}</p>
                </div>
              ))}
            </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}