"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import type { ResultAction } from "@/lib/admin-result-actions";

type Proposal = {
  id: string;
  action_type: string;
  description: string;
  risk_level: string;
  requested_at: string;
  metadata?: {
    reasoning?: string;
    proactive?: boolean;
    userMessage?: string;
    approvalReport?: {
      title: string;
      actionLabel: string;
      userRequest: string;
      whereToSeeResult: string;
      whatWillHappen: string[];
      benefits: string[];
      risks: string[];
      safeguards: string[];
    };
  };
};

type ApprovalReport = NonNullable<Proposal["metadata"]>["approvalReport"];

type ActivityStep = {
  id: string;
  label: string;
  status: "waiting" | "running" | "done" | "failed";
};

function fallbackApprovalReport(p: Proposal): ApprovalReport | undefined {
  const text = `${p.description} ${p.action_type}`.toLowerCase();
  if (!text.includes("evolve")) return undefined;
  return {
    title: "تقرير قرار قبل الموافقة",
    actionLabel: "مراجعة وتطوير آمن للموقع",
    userRequest: p.metadata?.userMessage || "طلب مراجعة أو تطوير من المساعد",
    whereToSeeResult:
      "ستظهر نتيجة الفحص أو الاقتراح داخل محادثة المساعد وداخل دفتر الأدلة. لو نتج عنه تعديل كود، سيظهر كطلب موافقة منفصل قبل تطبيقه.",
    whatWillHappen: [
      "سيفحص الطلب ويبحث عن تحسينات محتملة مرتبطة به.",
      "سيحاول اقتراح إصلاح أو خطة تطوير بدل تنفيذ تعديل عشوائي.",
      "لن يطبق أي تعديل كود أو تغيير حساس إلا بطلب موافقة منفصل وواضح.",
    ],
    benefits: [
      "يعطيك نتيجة قابلة للمراجعة بدل تنفيذ صامت.",
      "يسجل العملية في دفتر الأدلة حتى يمكن تتبع ما حدث.",
    ],
    risks: [
      "قد ينتج عنه اقتراح غير كاف إذا كان الطلب واسعاً أو الرابط غير قابل للقراءة.",
      "قد يحتاج وقتاً أطول لو تطلب فحص صفحات أو خدمات خارجية.",
    ],
    safeguards: [
      "لن يتم تنفيذ تغيير حساس قبل موافقتك.",
      "يمكنك رفض الطلب بدون أي أثر تنفيذي.",
    ],
  };
}

function stepTone(status: ActivityStep["status"]) {
  if (status === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "running") return "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#e8d5a8]";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/[0.03] text-white/40";
}

export function SovereignMindPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<string | null>(null);
  const [decisionActions, setDecisionActions] = useState<ResultAction[]>([]);
  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  function setStepStatus(id: string, status: ActivityStep["status"]) {
    setActivitySteps((steps) =>
      steps.map((step) => (step.id === id ? { ...step, status } : step))
    );
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mind");
      if (!res.ok) return;
      const data = await res.json();
      setProposals(data.proposals || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function runMindCycle() {
    setRunning(true);
    setThoughts(null);
    try {
      const res = await fetch("/api/admin/mind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.thoughts) setThoughts(data.thoughts);
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function decide(requestId: string, decision: "approve" | "reject") {
    setActingId(requestId);
    setDecisionResult(null);
    setDecisionActions([]);
    setActivitySteps([
      { id: "decision", label: decision === "approve" ? "تثبيت الموافقة" : "تثبيت الرفض", status: "running" },
      { id: "execute", label: decision === "approve" ? "تنفيذ المهمة الحقيقية" : "إيقاف المهمة بدون أثر", status: "waiting" },
      { id: "result", label: "تجهيز النتيجة وأزرار الوصول", status: "waiting" },
      { id: "refresh", label: "تحديث لوحة عقل النظام", status: "waiting" },
    ]);
    try {
      setStepStatus("decision", "done");
      setStepStatus("execute", "running");
      const res = await fetch("/api/admin/mind/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      const data = await res.json().catch(() => ({}));
      setStepStatus("execute", res.ok && data.success !== false ? "done" : "failed");
      setStepStatus("result", "running");
      setDecisionResult(
        data.message ||
          data.error ||
          (decision === "approve" ? "تمت الموافقة وتنفيذ الطلب." : "تم رفض الطلب.")
      );
      setDecisionActions(Array.isArray(data.actions) ? data.actions : []);
      setStepStatus("result", "done");
      setStepStatus("refresh", "running");
      await load();
      setStepStatus("refresh", "done");
    } catch (error) {
      setActivitySteps((steps) =>
        steps.map((step) =>
          step.status === "running" || step.status === "waiting"
            ? { ...step, status: "failed" }
            : step
        )
      );
      setDecisionResult(error instanceof Error ? error.message : "تعذر تنفيذ القرار.");
    } finally {
      setActingId(null);
      window.setTimeout(() => setActivitySteps([]), 2200);
    }
  }

  return (
    <div className="rounded-2xl border border-[#C5A059]/25 bg-gradient-to-b from-[#C5A059]/10 to-transparent p-4 flex flex-col gap-3 h-full min-h-[320px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#C5A059]" />
          <span className="font-semibold text-sm">عقل النظام</span>
        </div>
        <button
          type="button"
          onClick={runMindCycle}
          disabled={running}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50"
          title="فكّر الآن واقترح"
        >
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
          ) : (
            <RefreshCw className="w-4 h-4 text-[#C5A059]" />
          )}
        </button>
      </div>

      <p className="text-[11px] text-white/50 leading-relaxed">
        يعمل في الخلفية كل 6 ساعات — يستكشف، يفكّر، ويطلب إذنك قبل أي إجراء حساس.
      </p>

      {thoughts && (
        <div className="text-xs text-[#e8d5a8] bg-[#C5A059]/10 border border-[#C5A059]/20 rounded-xl p-3">
          <Sparkles className="w-3.5 h-3.5 inline ml-1 text-[#C5A059]" />
          {thoughts}
        </div>
      )}

      {decisionResult && (
        <div className="text-xs text-emerald-100 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 leading-relaxed">
          {decisionResult}
          {decisionActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {decisionActions.map((action) => (
                <a
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  target={action.kind === "external" ? "_blank" : undefined}
                  rel={action.kind === "external" ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-100 hover:border-emerald-300/70"
                >
                  {action.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activitySteps.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5 text-[#C5A059]" />
            تنفيذ حي أمامك
          </div>
          {activitySteps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${stepTone(step.status)}`}
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
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/40 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          جاري القراءة...
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center text-xs text-white/40 py-8">
          لا طلبات بانتظار الموافقة — النظام يراقب بهدوء.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {proposals.map((p) => {
            const report = p.metadata?.approvalReport || fallbackApprovalReport(p);
            return (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {report ? (
                    <div className="space-y-2 text-xs">
                      <p className="font-bold text-white">{report.title}</p>
                      <p className="text-[#e8d5a8]">{report.actionLabel}</p>
                      <div className="rounded-lg border border-white/10 bg-black/15 p-2">
                        <p className="text-[10px] text-white/40">طلبك</p>
                        <p className="mt-1 text-white/80">{report.userRequest}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-white/60">أين سترى النتيجة؟</p>
                        <p className="mt-1 text-white/70 leading-relaxed">{report.whereToSeeResult}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-white/60">ما الذي سيحدث؟</p>
                        <ul className="mt-1 space-y-1 text-white/70 leading-relaxed">
                          {report.whatWillHappen.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-300">الفائدة</p>
                        <ul className="mt-1 space-y-1 text-white/65">
                          {report.benefits.slice(0, 2).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-amber-300">المخاطر والحدود</p>
                        <ul className="mt-1 space-y-1 text-white/65">
                          {report.risks.slice(0, 2).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-white whitespace-pre-wrap">
                      {p.description}
                    </p>
                  )}
                  <p className="text-[10px] text-white/40 mt-1">
                    {p.risk_level} · {report?.actionLabel || p.action_type.replace("assistant_", "")}
                    {p.metadata?.proactive ? " · مبادرة من العقل" : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={actingId === p.id}
                  onClick={() => decide(p.id, "approve")}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-xs font-medium disabled:opacity-50"
                >
                  {actingId === p.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  موافقة
                </button>
                <button
                  type="button"
                  disabled={actingId === p.id}
                  onClick={() => decide(p.id, "reject")}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs disabled:opacity-50"
                >
                  <X className="w-3 h-3" />
                  رفض
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
