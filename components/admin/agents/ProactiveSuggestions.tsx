'use client';

/**
 * ProactiveSuggestions — اقتراحات الوكيل الاستباقي
 * يجلب من /api/admin/agents/suggestions ويعرضها مع أزرار: تنفيذ / رفض / تأجيل
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, PlayCircle, XCircle, Clock,
  Loader2, RefreshCw, Inbox, ChevronDown, ChevronUp
} from 'lucide-react';

interface Suggestion {
  id:          string;
  title:       string;
  description: string;
  status:      'pending' | 'executed' | 'rejected' | 'deferred';
  triggered_by?: string;
  created_at:  string;
  proposed_plan?: {
    estimatedRisk?: 'low' | 'medium' | 'high';
    steps?: { description: string }[];
  };
}

const RISK_STYLES = {
  low:    { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-500' },
  medium: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/20',    dot: 'bg-amber-500'   },
  high:   { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/20',       dot: 'bg-rose-500'    },
};

const RISK_LABELS = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' };

export function ProactiveSuggestions() {
  const [suggestions, setSuggestions]   = useState<Suggestion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [processing, setProcessing]     = useState<string | null>(null);
  const [expanded, setExpanded]         = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/agents/suggestions');
      const data = await res.json();
      if (data.success) {
        setSuggestions(
          (data.suggestions as Suggestion[]).filter(s => s.status === 'pending')
        );
      }
    } catch { /* صامت */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    const iv = setInterval(fetchSuggestions, 60_000);
    return () => clearInterval(iv);
  }, [fetchSuggestions]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleAction(id: string, action: 'execute' | 'reject' | 'defer') {
    if (processing) return;

    if (action === 'defer') {
      setSuggestions(s => s.filter(x => x.id !== id));
      showToast('تم تأجيل الاقتراح', true);
      return;
    }

    setProcessing(id);
    try {
      const res  = await fetch('/api/admin/agents/suggestions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ suggestion_id: id, action }),
      });
      const data = await res.json();

      if (data.success) {
        setSuggestions(s => s.filter(x => x.id !== id));
        showToast(
          action === 'execute' ? '✅ تم تنفيذ الاقتراح بنجاح' : '❌ تم رفض الاقتراح',
          true
        );
      } else {
        showToast(data.error || 'فشل العملية', false);
      }
    } catch {
      showToast('خطأ في الاتصال', false);
    } finally {
      setProcessing(null);
    }
  }

  const fmt = (d: string) =>
    new Date(d).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C5A059]" />
          اقتراحات استباقية
        </h2>
        <div className="flex items-center gap-2">
          {suggestions.length > 0 && (
            <span className="px-2 py-0.5 bg-[#C5A059]/20 border border-[#C5A059]/30 text-[#C5A059] rounded-full text-[10px] font-bold">
              {suggestions.length}
            </span>
          )}
          <button
            onClick={fetchSuggestions}
            disabled={loading}
            className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`p-3 rounded-xl text-xs font-medium border ${
          toast.ok
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-7 h-7 text-[#C5A059] animate-spin" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Inbox className="w-10 h-10 text-white/10 mb-3" />
          <p className="text-white/40 text-sm font-medium">لا توجد اقتراحات معلقة</p>
          <p className="text-white/20 text-xs mt-1">
            الوكيل الاستباقي يفحص النظام كل 6 ساعات
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {suggestions.map(s => {
            const risk    = s.proposed_plan?.estimatedRisk ?? 'low';
            const rStyle  = RISK_STYLES[risk];
            const isExp   = expanded === s.id;
            const isProc  = processing === s.id;
            const steps   = s.proposed_plan?.steps ?? [];

            return (
              <div
                key={s.id}
                className="border border-white/5 bg-white/[0.02] rounded-2xl p-4 space-y-3 transition-all"
              >
                {/* Top */}
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${rStyle.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${rStyle.badge}`}>
                        خطر {RISK_LABELS[risk]}
                      </span>
                      <span className="text-[10px] text-white/30">{fmt(s.created_at)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white/90 leading-snug">{s.title}</h3>
                    <p className="text-xs text-white/50 mt-1 leading-relaxed">{s.description}</p>
                  </div>

                  {steps.length > 0 && (
                    <button
                      onClick={() => setExpanded(isExp ? null : s.id)}
                      className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {isExp
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </button>
                  )}
                </div>

                {/* Steps preview */}
                {isExp && steps.length > 0 && (
                  <div className="bg-black/20 rounded-xl p-3 space-y-1.5">
                    {steps.map((st, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] text-white/50">
                        <span className="text-[#C5A059]/60 shrink-0 font-mono">{i + 1}.</span>
                        <span>{st.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(s.id, 'reject')}
                    disabled={!!isProc}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/20 disabled:opacity-40 transition-all text-xs font-bold"
                  >
                    {isProc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    رفض
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'defer')}
                    disabled={!!isProc}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/5 border border-white/10 text-white/50 rounded-xl hover:bg-white/10 disabled:opacity-40 transition-all text-xs font-bold"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    تأجيل
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'execute')}
                    disabled={!!isProc}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/20 disabled:opacity-40 transition-all text-xs font-bold"
                  >
                    {isProc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                    تنفيذ
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
