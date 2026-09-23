'use client';

/**
 * QayyimObservabilityDashboard — مراقبة صحة السرب: معدلات النجاح، زمن التنفيذ، بوابة الجودة
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react';

interface AgentMetrics {
  agent_key: string;
  total_24h: number;
  completed_24h: number;
  failed_24h: number;
  avg_duration_ms: number | null;
  success_rate: number | null;
}

interface ObservabilityData {
  agents: AgentMetrics[];
  totals: { tasks_24h: number; success_rate: number | null; avg_duration_ms: number | null };
  quality_gate: { passed_24h: number; failed_24h: number };
}

export function QayyimObservabilityDashboard() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/qayyim/observability?metric=dashboard');
      const json = await res.json();
      if (json.success) setData(json.dashboard);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading && !data) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
        لا توجد بيانات مراقبة بعد — ستتراكم مع تشغيل مهام السرب
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top-level stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigStat label="مهام (24 ساعة)" value={data.totals.tasks_24h} icon={Zap} />
        <BigStat
          label="معدل النجاح"
          value={data.totals.success_rate !== null ? `${Math.round(data.totals.success_rate * 100)}%` : '—'}
          icon={CheckCircle2}
          tone={data.totals.success_rate !== null && data.totals.success_rate >= 0.9 ? 'good' : 'warn'}
        />
        <BigStat
          label="متوسط الزمن"
          value={data.totals.avg_duration_ms !== null ? `${(data.totals.avg_duration_ms / 1000).toFixed(1)}s` : '—'}
          icon={Clock}
        />
        <BigStat
          label="بوابة الجودة"
          value={`${data.quality_gate.passed_24h} ✓ / ${data.quality_gate.failed_24h} ✗`}
          icon={Activity}
          tone={data.quality_gate.failed_24h === 0 ? 'good' : 'warn'}
        />
      </div>

      {/* Per-agent table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/70">أداء الوكلاء (آخر 24 ساعة)</span>
          <button onClick={fetchData} className="p-1 rounded text-white/40 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {data.agents.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-white/30">لا نشاط مسجل في آخر 24 ساعة</div>
          ) : (
            data.agents.map((agent) => {
              const rate = agent.success_rate;
              const ratePct = rate !== null ? Math.round(rate * 100) : null;
              return (
                <div key={agent.agent_key} className="px-4 py-3 flex items-center gap-4">
                  <span className="text-xs font-mono text-white/70 w-32 shrink-0" dir="ltr">{agent.agent_key}</span>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ratePct === null ? 'bg-white/10' : ratePct >= 90 ? 'bg-emerald-400' : ratePct >= 70 ? 'bg-amber-400' : 'bg-rose-400'
                        }`}
                        style={{ width: `${ratePct ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] shrink-0">
                    <span className="text-white/50" dir="ltr">{agent.total_24h} tasks</span>
                    <span className={ratePct !== null && ratePct >= 90 ? 'text-emerald-300' : 'text-white/60'} dir="ltr">
                      {ratePct !== null ? `${ratePct}%` : '—'}
                    </span>
                    {agent.failed_24h > 0 && (
                      <span className="flex items-center gap-0.5 text-rose-300">
                        <XCircle className="w-3 h-3" /> {agent.failed_24h}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone?: 'good' | 'warn' }) {
  return (
    <div className={`rounded-xl border p-3.5 ${
      tone === 'good' ? 'border-emerald-500/20 bg-emerald-500/5'
      : tone === 'warn' ? 'border-amber-500/20 bg-amber-500/5'
      : 'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-white/50">{label}</span>
        <Icon className={`w-4 h-4 ${tone === 'good' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-white/40'}`} />
      </div>
      <div className="text-lg font-bold text-white" dir="ltr">{value}</div>
    </div>
  );
}
