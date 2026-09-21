"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Database, FileText, Lightbulb, Loader2, Play, RefreshCw, Shield, Sparkles, XCircle, Zap } from "lucide-react";

type PlanStep = { id: number; action: "sql" | "api" | "update_settings" | "send_notification" | "analyze"; description: string; requiresApproval: boolean; riskLevel: "low" | "medium" | "high" };
type Suggestion = { id: string; title: string; description: string; status: "pending" | "approved" | "rejected" | "executed" | "failed"; created_at: string; risk_level: string; proposed_plan?: { steps: PlanStep[] }; execution_result?: { status: string; results: Array<{ success: boolean; error?: string }> } };
type Filter = "all" | "pending" | "executed" | "rejected";

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function SmartSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  async function fetchSuggestions() {
    try {
      setLoading(true);
      setError(null);
      const data = await readResponse(await fetch("/api/omnipotent?action=suggestions", { cache: "no-store" }));
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل المقترحات");
    } finally { setLoading(false); }
  }

  useEffect(() => { void fetchSuggestions(); }, []);

  async function mutate(action: "execute" | "reject", suggestionId: string) {
    try {
      setBusyId(suggestionId);
      await readResponse(await fetch("/api/omnipotent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, suggestionId }) }));
      await fetchSuggestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية");
    } finally { setBusyId(null); }
  }

  async function askAgent(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      setQueryLoading(true); setAnswer(null);
      const data = await readResponse(await fetch("/api/omnipotent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "query", query: query.trim() }) }));
      setAnswer(data.response || data.reply || "تمت المعالجة دون رد نصي.");
    } catch (err) { setAnswer(`خطأ: ${err instanceof Error ? err.message : "تعذر الاتصال بالوكيل"}`); }
    finally { setQueryLoading(false); }
  }

  const visible = filter === "all" ? suggestions : suggestions.filter((item) => item.status === filter);
  const icon = (action: string) => action === "sql" ? <Database className="h-4 w-4" /> : action === "api" ? <Zap className="h-4 w-4" /> : action === "update_settings" ? <FileText className="h-4 w-4" /> : action === "analyze" ? <Sparkles className="h-4 w-4" /> : <Shield className="h-4 w-4" />;
  const statusIcon = (status: Suggestion["status"]) => status === "pending" ? <Clock className="h-5 w-5 text-amber-400" /> : status === "executed" || status === "approved" ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : status === "rejected" ? <XCircle className="h-5 w-5 text-rose-400" /> : <AlertTriangle className="h-5 w-5 text-rose-400" />;

  return <div className="space-y-6">
    <header className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><Lightbulb className="h-6 w-6 text-[#C5A059]" />المقترحات الذكية</h2><p className="mt-1 text-sm text-white/60">عمليات حقيقية مرتبطة بجلسة الأدمن، بدون مفاتيح عامة أو هوية ثابتة.</p></div><button onClick={() => void fetchSuggestions()} className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-white/70"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />تحديث</button></header>
    <form onSubmit={askAgent} className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-6"><h3 className="mb-4 flex items-center gap-2 font-medium text-white"><Sparkles className="h-4 w-4 text-[#C5A059]" />سؤال الوكيل الذكي</h3><div className="flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="اكتب سؤالًا للوكيل..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white outline-none" /><button disabled={queryLoading || !query.trim()} className="flex items-center gap-2 rounded-lg bg-[#C5A059] px-6 py-2 text-[#1a1a1a] disabled:opacity-50">{queryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}إرسال</button></div>{answer && <p className="mt-4 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-4 text-white/80">{answer}</p>}</form>
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{error}</div>}
    <div className="flex gap-2 border-b border-white/10 pb-4">{(["all", "pending", "executed", "rejected"] as Filter[]).map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg px-4 py-2 text-sm ${filter === value ? "border border-[#C5A059]/30 bg-[#C5A059]/20 text-[#C5A059]" : "text-white/60"}`}>{value === "all" ? "الكل" : value === "pending" ? "معلقة" : value === "executed" ? "منفذة" : "مرفوضة"} ({value === "all" ? suggestions.length : suggestions.filter((item) => item.status === value).length})</button>)}</div>
    {loading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#C5A059]" /></div> : visible.length === 0 ? <div className="rounded-xl border border-white/10 p-12 text-center text-white/40">لا توجد مقترحات</div> : <div className="space-y-4">{visible.map((item) => <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"><button className="flex w-full items-start gap-4 p-4 text-right" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{statusIcon(item.status)}<span className="flex-1"><strong className="text-white">{item.title}</strong><span className="mt-1 block text-sm text-white/60">{item.description}</span><span className="mt-2 block text-xs text-white/40">{new Date(item.created_at).toLocaleString("ar-SA")} · {item.status}</span></span>{expandedId === item.id ? <XCircle className="h-5 w-5 text-white/40" /> : <Clock className="h-5 w-5 text-white/40" />}</button>{expandedId === item.id && <div className="space-y-4 border-t border-white/10 p-4">{item.proposed_plan?.steps.map((step) => <div key={step.id} className="flex gap-3 rounded-lg bg-white/5 p-3 text-sm text-white/80">{icon(step.action)}<span>{step.description}{step.requiresApproval && <Shield className="ml-2 inline h-4 w-4 text-amber-400" />}</span></div>)}{item.execution_result && <div className="rounded-lg bg-white/5 p-3 text-sm text-white/70">الحالة: {item.execution_result.status}</div>}{item.status === "pending" && <div className="flex gap-3"><button disabled={busyId === item.id} onClick={() => void mutate("execute", item.id)} className="flex items-center gap-2 rounded-lg bg-emerald-500/20 px-4 py-2 text-emerald-300 disabled:opacity-50"><Play className="h-4 w-4" />{busyId === item.id ? "جارٍ التنفيذ..." : "نفذ الخطة"}</button><button disabled={busyId === item.id} onClick={() => void mutate("reject", item.id)} className="rounded-lg bg-rose-500/20 px-4 py-2 text-rose-300">رفض</button></div>}</div>}</article>)}</div>}
  </div>;
}
