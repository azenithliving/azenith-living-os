"use client";

import { motion } from "framer-motion";
import {
  Sparkles, Zap, EyeOff, Ghost, Clock, Ban, Radio, ShieldAlert,
  RefreshCw, Users, Loader2, Target, X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface FateMutation {
  id: string;
  session_id: string | null;
  type: string;
  action: string;
  payload: Record<string, any>;
  active: boolean;
  created_at: string;
  name?: string;
}

interface SessionOption {
  session_id: string;
  name: string;
  updated_at: string;
}

const ACTIONS = [
  { id: "QUANTUM_OFFER", name: "العرض الكمي", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", description: "خصم 25% فوري مع عدّاد تنازلي." },
  { id: "THUNDER", name: "الصاعقة", icon: Zap, color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", description: "وميض أخضر + خصم 15% خلال ثوانٍ." },
  { id: "HALLUCINATION", name: "الإيهام", icon: EyeOff, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", description: "إيهام بوجود منافسين يشاهدون التصميم الآن." },
  { id: "FREEZE", name: "التجميد", icon: Ghost, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", description: "قفل الشاشة وإجبار العميل على عرض معيّن." },
];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "الآن";
  if (diff < 3_600_000) return `منذ ${Math.floor(diff / 60_000)} دقيقة`;
  return `منذ ${Math.floor(diff / 3_600_000)} ساعة`;
}

export default function FateControlPage() {
  const [mutations, setMutations] = useState<FateMutation[]>([]);
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"all" | "session">("all");
  const [targetSession, setTargetSession] = useState<string>("");
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [offerText, setOfferText] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [busyPatch, setBusyPatch] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/fate");
      if (!res.ok) throw new Error("فشل التحميل");
      const data = await res.json();
      if (Array.isArray(data.mutations)) setMutations(data.mutations);
      if (Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        setTargetSession((prev) => prev || data.sessions[0]?.session_id || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const activeCount = mutations.filter((m) => m.active).length;
  const sessionsTouched = new Set(mutations.filter((m) => m.session_id && m.session_id !== "__GLOBAL__").map((m) => m.session_id)).size;
  const activeList = mutations.filter((m) => m.active);
  const history = filter === "all" ? mutations : mutations.filter((m) => m.action === filter);

  const trigger = async (action: string, payload: Record<string, any> = {}) => {
    const body = targetMode === "session"
      ? { action, payload, sessionId: targetSession }
      : { action, payload, global: true };

    setBusyAction(action);
    try {
      const res = await fetch("/api/admin/fate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل التنفيذ");
      toast.success(
        targetMode === "session"
          ? "تم إطلاق أمر القدر على الجلسة المحددة!"
          : `أُرسل الأمر إلى ${data.targetedSessions ?? 0} جلسة نشطة`,
        { id: "fate-trigger" }
      );
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل في إطلاق القدر. العميل قد يكون محصناً!", { id: "fate-trigger" });
    } finally {
      setBusyAction(null);
    }
  };

  const runPatch = async (body: Record<string, any>, successMsg: string) => {
    try {
      const res = await fetch("/api/admin/fate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("فشل التنفيذ");
      toast.success(successMsg, { id: "fate-patch" });
      load();
    } catch (e: any) {
      toast.error(e?.message || "فشل إلغاء الأمر", { id: "fate-patch" });
    }
  };

  const handleFreeze = () => {
    if (!offerText.trim()) {
      toast.error("اكتب نص العرض قبل التجميد", { id: "fate-freeze" });
      return;
    }
    setFreezeOpen(false);
    trigger("FREEZE", { offerText: offerText.trim() });
    setOfferText("");
  };

  const onTriggerCard = (action: { id: string; name: string }) => {
    if (action.id === "FREEZE") {
      setFreezeOpen(true);
      return;
    }
    trigger(action.id);
  };

  const killAll = async () => {
    setBusyPatch("all");
    await runPatch({ all: true }, "تم إيقاف جميع الأوامر القدرية فوراً. سلم الوضع.");
    setBusyPatch(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* HEADER */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
            <Sparkles className="text-amber-500" /> التحكم في القدر
          </h1>
          <p className="text-white/50">تحكم في تجربة العميل في الوقت الفعلي باستخدام أوامر القدر الاستثنائية.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm">
            <Radio className={`w-4 h-4 ${activeCount > 0 ? "text-amber-400 animate-pulse" : "text-white/30"}`} />
            <span className="text-white/60">{activeCount > 0 ? "قيد التشغيل" : "خامل"}</span>
            <span className="font-bold text-white">{activeCount}</span>
          </div>
          <button
            onClick={load}
            className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
            title="تحديث"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* LIVE STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "أوامر نشطة الآن", value: activeCount, icon: Radio, color: "text-amber-400" },
          { label: "جلسات مستهدفة", value: sessionsTouched, icon: Target, color: "text-blue-400" },
          { label: "جلسات متاحة", value: sessions.length, icon: Users, color: "text-emerald-400" },
          { label: "إجمالي العمليات", value: mutations.length, icon: Clock, color: "text-purple-400" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-4 flex items-center gap-4"
          >
            <div className={`p-3 rounded-2xl bg-white/5 ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">{s.value}</div>
              <div className="text-xs text-white/40">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* TARGET SELECTOR */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="text-sm text-white/50">استهداف:</span>
        <div className="flex rounded-2xl bg-white/5 border border-white/10 p-1">
          <button
            onClick={() => setTargetMode("all")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${targetMode === "all" ? "bg-[#C5A059] text-black" : "text-white/60 hover:text-white"}`}
          >
            كل الزوار
          </button>
          <button
            onClick={() => setTargetMode("session")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${targetMode === "session" ? "bg-[#C5A059] text-black" : "text-white/60 hover:text-white"}`}
          >
            جلسة محددة
          </button>
        </div>
        {targetMode === "session" && (
          <select
            value={targetSession}
            onChange={(e) => setTargetSession(e.target.value)}
            className="bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#C5A059]"
          >
            {sessions.length === 0 && <option value="">لا توجد جلسات نشطة</option>}
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.name} — {s.session_id.slice(0, 8)}…
              </option>
            ))}
          </select>
        )}
      </div>

      {/* TRIGGER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {ACTIONS.map((action, i) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileHover={{ scale: 1.01 }}
            className={`bg-white/5 border ${action.bg.split(" ")[1]} p-6 rounded-3xl backdrop-blur-xl`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${action.color}`}>
                <action.icon className="w-6 h-6" />
              </div>
              <button
                onClick={() => onTriggerCard(action)}
                disabled={busyAction !== null || (targetMode === "session" && !targetSession)}
                className="px-6 py-2 rounded-xl bg-[#C5A059] text-black font-bold hover:bg-[#D4B16A] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busyAction === action.id ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الإرسال...</span>
                ) : (
                  "إطلاق الآن"
                )}
              </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{action.name}</h3>
            <p className="text-white/40 text-sm">{action.description}</p>
            <div className="mt-4 text-xs text-white/30">
              {targetMode === "all" ? "يصل لجميع الجلسات النشطة" : "يصل لجلسة واحدة فقط"}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ACTIVE ACTIONS */}
      <div className="mb-8 p-8 rounded-[2.5rem] border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Radio className="text-amber-500" />
            <h2 className="text-xl font-bold text-white">الأوامر النشطة حالياً</h2>
          </div>
          {activeCount > 0 && (
            <button
              onClick={killAll}
              disabled={busyPatch === "all"}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 font-bold text-sm hover:bg-rose-600/30 transition-all disabled:opacity-50"
            >
              {busyPatch === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
              إيقاف الطوارئ
            </button>
          )}
        </div>

        {activeList.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-8">لا توجد أوامر نشطة حالياً.</div>
        ) : (
          <div className="space-y-3">
            {activeList.map((m) => {
              const def = ACTIONS.find((a) => a.id === m.action);
              return (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl bg-white/5 ${def?.color || "text-white/50"}`}>
                      {def ? <def.icon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-sm">
                        {def?.name || m.action}
                        {m.session_id === "__GLOBAL__" && <span className="mr-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">سجل</span>}
                      </div>
                      <div className="text-xs text-white/40 truncate">
                        {m.session_id === "__GLOBAL__" ? "أمر عام (لا جلسات متاحة وقتها)" : m.name || m.session_id}
                        {m.action === "FREEZE" && m.payload?.offerText ? ` — "${m.payload.offerText.slice(0, 40)}…"` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-white/40">{timeAgo(m.created_at)}</span>
                    <button
                      onClick={() => runPatch({ id: m.id }, "تم إلغاء الأمر")}
                      disabled={busyPatch !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition-all disabled:opacity-50"
                    >
                      <Ban className="w-3.5 h-3.5" /> إلغاء
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HISTORY */}
      <div className="p-8 rounded-[2.5rem] border border-white/10 bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Clock className="text-[#C5A059]" />
            <h2 className="text-xl font-bold text-white">سجل العمليات القدرية</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === "all" ? "bg-[#C5A059] text-black" : "bg-white/5 text-white/50 hover:text-white"}`}
            >
              الكل
            </button>
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setFilter(a.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === a.id ? "bg-[#C5A059] text-black" : "bg-white/5 text-white/50 hover:text-white"}`}
              >
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-10">لا توجد عمليات بعد.</div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 15).map((m) => {
              const def = ACTIONS.find((a) => a.id === m.action);
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 text-sm">
                  <div className={`p-2 rounded-xl bg-white/5 ${def?.color || "text-white/50"}`}>
                    {def ? <def.icon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-white">{def?.name || m.action}</span>
                    <span className="text-white/40 text-xs mr-2">
                      {m.session_id === "__GLOBAL__" ? "عام" : m.name || m.session_id}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${
                      m.active
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {m.active ? "نشط" : "متوقف"}
                  </span>
                  <span className="text-white/30 text-xs shrink-0" dir="ltr">{formatTime(m.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FREEZE MODAL */}
      {freezeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#131313] border border-blue-400/20 rounded-[2rem] p-8 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Ghost className="text-blue-400" /> عرض التجميد
              </h3>
              <button onClick={() => setFreezeOpen(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <label className="block text-sm text-white/50 mb-2">نص العرض الذي سيظهر للعميل أثناء التجميد:</label>
            <textarea
              value={offerText}
              onChange={(e) => setOfferText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="مثال: الفرصة الحالية محدودة… خصم خاص 20% ينتهي خلال 60 ثانية"
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-blue-400 resize-none text-sm"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setFreezeOpen(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold hover:text-white transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleFreeze}
                className="flex-1 py-3 rounded-2xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-all"
              >
                تجميد الشاشة
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
