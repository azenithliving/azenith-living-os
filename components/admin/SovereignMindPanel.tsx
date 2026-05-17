"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Check,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  X,
} from "lucide-react";

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
  };
};

export function SovereignMindPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

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
    try {
      await fetch("/api/admin/mind/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, decision }),
      });
      await load();
    } finally {
      setActingId(null);
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
          {proposals.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white whitespace-pre-wrap">
                    {p.description}
                  </p>
                  <p className="text-[10px] text-white/40 mt-1">
                    {p.risk_level} · {p.action_type.replace("assistant_", "")}
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
          ))}
        </div>
      )}
    </div>
  );
}

