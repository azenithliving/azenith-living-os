'use client';

/**
 * AgentActionsFeed — شريط أحداث حي
 * يجلب من /api/admin/agents/tasks و /api/admin/agents/events بـ polling كل 10 ثواني
 * يعرض كل إجراء مع: الوكيل، نوع الإجراء، النتيجة، الوقت
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';

interface FeedItem {
  id:         string;
  agent:      string;
  type:       string;
  title:      string;
  status:     'completed' | 'failed' | 'running' | 'pending';
  created_at: string;
  duration_ms?: number;
}

const STATUS_STYLES: Record<string, { icon: React.ReactNode; dot: string; text: string }> = {
  completed: {
    icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    dot:  'bg-emerald-500',
    text: 'text-emerald-400',
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
    dot:  'bg-rose-500',
    text: 'text-rose-400',
  },
  running: {
    icon: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
    dot:  'bg-amber-500 animate-pulse',
    text: 'text-amber-400',
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5 text-white/30" />,
    dot:  'bg-white/20',
    text: 'text-white/40',
  },
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'مكتمل',
  failed:    'فاشل',
  running:   'جاري',
  pending:   'معلق',
};

const AGENT_COLORS: Record<string, string> = {
  prime:    'text-purple-400 bg-purple-500/10 border-purple-500/20',
  vanguard: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  system:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s    = Math.floor(diff / 1000);
  if (s < 60)  return `منذ ${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `منذ ${h} س`;
  return new Date(dateStr).toLocaleDateString('ar-EG');
}

export function AgentActionsFeed() {
  const [items, setItems]         = useState<FeedItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [filter, setFilter]       = useState<'all' | 'completed' | 'failed' | 'running'>('all');
  const isFirstLoad               = useRef(true);

  const fetchFeed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch('/api/admin/agents/tasks?limit=30&order=desc');
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const mapped: FeedItem[] = data.data.map((t: any) => ({
          id:          t.id,
          agent:       t.agent_key || t.assigned_agent || 'system',
          type:        t.task_type || 'task',
          title:       t.title || t.description || 'مهمة',
          status:      t.status === 'done' ? 'completed' :
                       t.status === 'error' ? 'failed' :
                       t.status === 'in_progress' ? 'running' : (t.status ?? 'pending'),
          created_at:  t.created_at,
          duration_ms: t.duration_ms,
        }));
        setItems(mapped);
        setLastUpdate(new Date());
      }
    } catch { /* صامت */ }
    finally {
      if (!silent || isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const iv = setInterval(() => fetchFeed(true), 10_000);
    return () => clearInterval(iv);
  }, [fetchFeed]);

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  const counts = {
    completed: items.filter(i => i.status === 'completed').length,
    failed:    items.filter(i => i.status === 'failed').length,
    running:   items.filter(i => i.status === 'running').length,
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#C5A059]" />
          سجل الأحداث الحي
        </h2>
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          {lastUpdate && <span>آخر تحديث: {relativeTime(lastUpdate.toISOString())}</span>}
          <button
            onClick={() => fetchFeed()}
            className="p-1 hover:text-white/60 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'completed', label: 'مكتملة', color: 'emerald', count: counts.completed },
            { key: 'running',   label: 'جارية',  color: 'amber',   count: counts.running  },
            { key: 'failed',    label: 'فاشلة',  color: 'rose',    count: counts.failed   },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(prev => prev === s.key ? 'all' : s.key as any)}
              className={`p-2 rounded-xl border text-center transition-all ${
                filter === s.key
                  ? s.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/30' :
                    s.color === 'amber'   ? 'bg-amber-500/20 border-amber-500/30'     :
                                            'bg-rose-500/20 border-rose-500/30'
                  : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
              }`}
            >
              <p className={`text-lg font-black ${
                s.color === 'emerald' ? 'text-emerald-400' :
                s.color === 'amber'   ? 'text-amber-400'   : 'text-rose-400'
              }`}>{s.count}</p>
              <p className="text-[9px] text-white/30 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      {loading && isFirstLoad.current ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-7 h-7 text-[#C5A059] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <Activity className="w-10 h-10 text-white/10 mb-3" />
          <p className="text-white/40 text-sm font-medium">لا توجد أحداث بعد</p>
          <p className="text-white/20 text-xs mt-1">
            ستظهر هنا كل إجراءات الوكلاء لحظة بلحظة
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filtered.map(item => {
            const st        = STATUS_STYLES[item.status] ?? STATUS_STYLES.pending;
            const agentCls  = AGENT_COLORS[item.agent] ?? AGENT_COLORS.system;

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.03] transition-all"
              >
                {/* Status dot */}
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${st.dot}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${agentCls}`}>
                      {item.agent}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">{item.type}</span>
                  </div>
                  <p className="text-xs text-white/80 mt-0.5 truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className={`flex items-center gap-1 text-[10px] ${st.text}`}>
                      {st.icon}
                      <span>{STATUS_LABELS[item.status]}</span>
                    </div>
                    {item.duration_ms && (
                      <span className="text-[10px] text-white/20">
                        {item.duration_ms < 1000
                          ? `${item.duration_ms}ms`
                          : `${(item.duration_ms / 1000).toFixed(1)}s`}
                      </span>
                    )}
                    <span className="text-[10px] text-white/20 mr-auto">
                      {relativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
