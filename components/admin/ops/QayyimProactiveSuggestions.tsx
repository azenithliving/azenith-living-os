'use client';

/**
 * QayyimProactiveSuggestions — اقتراحات السرب الاستباقية (قبول / رفض / تحويل لمسودة)
 */

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Inbox } from 'lucide-react';

interface Suggestion {
  id: string;
  source_agent: string;
  suggestion_type: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  evidence: Record<string, any>;
  created_at: string;
}

const PRIORITY_STYLE: Record<string, { badge: string; label: string }> = {
  critical: { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',     label: 'حرجة' },
  high:     { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25',  label: 'عالية' },
  medium:   { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25',        label: 'متوسطة' },
  low:      { badge: 'bg-white/10 text-white/50 border-white/15',           label: 'منخفضة' },
};

export function QayyimProactiveSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ops/suggestions?status=pending');
      const data = await res.json();
      if (data.success) setSuggestions(data.suggestions || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchSuggestions();
    const iv = setInterval(fetchSuggestions, 60_000);
    return () => clearInterval(iv);
  }, [fetchSuggestions]);

  async function handleAction(id: string, action: 'accept' | 'dismiss') {
    if (acting) return;
    setActing(id);
    try {
      await fetch('/api/admin/ops/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: id, action }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
    finally { setActing(null); }
  }

  if (loading && suggestions.length === 0) {
    return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-white/30 text-sm">
        <Inbox className="w-7 h-7 mx-auto mb-2 opacity-40" />
        لا اقتراحات معلقة — السرب يراقب وسيُقترح عند وجود فرص تحسين
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/60">
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        اقتراحات استباقية ({suggestions.length})
      </div>

      {suggestions.map((s) => {
        const ps = PRIORITY_STYLE[s.priority] || PRIORITY_STYLE.medium;
        const isExpanded = expanded === s.id;
        const isActing = acting === s.id;
        return (
          <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <button
              onClick={() => setExpanded(isExpanded ? null : s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-white/[0.03] transition-colors"
            >
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${ps.badge}`}>{ps.label}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">{s.title}</div>
                <div className="text-[11px] text-white/40 truncate" dir="ltr">{s.source_agent} · {s.suggestion_type}</div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30 shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
                {s.description && <p className="text-sm text-white/70 leading-relaxed">{s.description}</p>}
                {Object.keys(s.evidence || {}).length > 0 && (
                  <pre className="rounded-lg bg-black/40 border border-white/10 p-3 text-[11px] text-white/60 overflow-x-auto max-h-32" dir="ltr">
                    {JSON.stringify(s.evidence, null, 2)}
                  </pre>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(s.id, 'accept')}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                  >
                    {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    قبول وتحويل لمسودة
                  </button>
                  <button
                    onClick={() => handleAction(s.id, 'dismiss')}
                    disabled={isActing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-white/50 text-xs font-medium hover:bg-white/5 transition-colors disabled:opacity-40"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    تجاهل
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
