'use client';

/**
 * AgentHealthPanel — لوحة صحة النظام
 * يجلب من /api/admin/agents/chat (حالة PRIME/Vanguard)
 * و /api/admin/agents/tasks (إحصائيات التنفيذ)
 * يعرض: حالة كل API key pool، معدل النجاح/الفشل، عدد المهام
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart, Cpu, Zap, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';

interface AgentHealth {
  agent:          string;
  status:         string;
  taskCount:      number;
  successRate:    number;
  avgResponseMs:  number;
  recentActivity: string;
}

interface SystemMetrics {
  totalTasks:     number;
  completedTasks: number;
  failedTasks:    number;
  runningTasks:   number;
  successRate:    number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; dot: string; label: string }> = {
  online:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500',            label: 'متاح'     },
  busy:    { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     dot: 'bg-amber-500 animate-pulse', label: 'مشغول'    },
  offline: { color: 'text-white/30',    bg: 'bg-white/[0.03] border-white/5',          dot: 'bg-white/20',               label: 'غير متاح' },
};

function HealthBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-white/40 w-8 text-right">{value}%</span>
    </div>
  );
}

export function AgentHealthPanel() {
  const [agents, setAgents]     = useState<AgentHealth[]>([]);
  const [metrics, setMetrics]   = useState<SystemMetrics | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [chatRes, tasksRes] = await Promise.all([
        fetch('/api/admin/agents/chat'),
        fetch('/api/admin/agents/tasks?limit=100'),
      ]);

      const chatData  = await chatRes.json();
      const tasksData = await tasksRes.json();

      // ── تجميع بيانات الوكلاء ────────────────────────────────────
      if (chatData.success && chatData.data) {
        const agentList: AgentHealth[] = Object.entries(chatData.data)
          .filter(([k]) => k !== 'timestamp')
          .map(([key, val]: [string, any]) => ({
            agent:          key,
            status:         val?.status         ?? 'offline',
            taskCount:      val?.taskCount       ?? 0,
            successRate:    val?.successRate     ?? 0,
            avgResponseMs:  val?.avgResponseMs   ?? 0,
            recentActivity: val?.recentActivity  ?? '',
          }));
        setAgents(agentList);
      }

      // ── تجميع مقاييس المهام ─────────────────────────────────────
      if (tasksData.success && Array.isArray(tasksData.data)) {
        const tasks = tasksData.data as any[];
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
        const failed    = tasks.filter(t => t.status === 'failed'    || t.status === 'error').length;
        const running   = tasks.filter(t => t.status === 'in_progress' || t.status === 'running').length;
        const total     = tasks.length;
        const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

        setMetrics({ totalTasks: total, completedTasks: completed, failedTasks: failed, runningTasks: running, successRate: rate });
      }

      setLastUpdate(new Date());
    } catch { /* صامت */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(() => fetchHealth(true), 30_000);
    return () => clearInterval(iv);
  }, [fetchHealth]);

  const overallHealth = metrics
    ? metrics.successRate >= 80 ? 'healthy' : metrics.successRate >= 50 ? 'warning' : 'critical'
    : 'unknown';

  const healthConfig = {
    healthy: { icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, text: 'النظام يعمل بكفاءة', color: 'text-emerald-400' },
    warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,   text: 'يحتاج مراجعة',       color: 'text-amber-400'   },
    critical:{ icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,    text: 'يحتاج تدخل فوري',   color: 'text-rose-400'    },
    unknown: { icon: <Loader2 className="w-4 h-4 text-white/30 animate-spin" />, text: 'جاري التحقق…', color: 'text-white/30' },
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          صحة النظام
        </h2>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-white/20">
              {new Date(lastUpdate).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button onClick={() => fetchHealth()} className="p-1 text-white/30 hover:text-white/60 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !lastUpdate ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-7 h-7 text-rose-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Overall Health Banner */}
          <div className={`flex items-center gap-3 p-3 rounded-2xl border ${
            overallHealth === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20' :
            overallHealth === 'warning' ? 'bg-amber-500/10 border-amber-500/20'     :
            overallHealth === 'critical'? 'bg-rose-500/10 border-rose-500/20'       :
                                          'bg-white/[0.02] border-white/5'
          }`}>
            {healthConfig[overallHealth].icon}
            <span className={`text-sm font-bold ${healthConfig[overallHealth].color}`}>
              {healthConfig[overallHealth].text}
            </span>
            {metrics && (
              <span className="mr-auto text-xs text-white/30">
                معدل النجاح: {metrics.successRate}%
              </span>
            )}
          </div>

          {/* System Metrics */}
          {metrics && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <TrendingUp className="w-4 h-4" />,   label: 'إجمالي المهام',  value: metrics.totalTasks,     color: 'text-blue-400'   },
                { icon: <CheckCircle className="w-4 h-4" />,  label: 'مكتملة',          value: metrics.completedTasks, color: 'text-emerald-400' },
                { icon: <Zap className="w-4 h-4" />,          label: 'جارية',           value: metrics.runningTasks,   color: 'text-amber-400'  },
                { icon: <AlertTriangle className="w-4 h-4" />,label: 'فاشلة',           value: metrics.failedTasks,    color: 'text-rose-400'   },
              ].map(m => (
                <div key={m.label} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                  <span className={`${m.color} opacity-60`}>{m.icon}</span>
                  <div>
                    <p className="text-[10px] text-white/30">{m.label}</p>
                    <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* معدل النجاح */}
          {metrics && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/40">معدل نجاح الإجراءات</span>
              </div>
              <HealthBar
                value={metrics.successRate}
                color={
                  metrics.successRate >= 80 ? 'bg-emerald-500' :
                  metrics.successRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                }
              />
            </div>
          )}

          {/* Agent Cards */}
          {agents.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">الوكلاء</p>
              {agents.map(agent => {
                const sc = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
                return (
                  <div key={agent.agent} className={`flex items-center gap-3 p-3 rounded-xl border ${sc.bg}`}>
                    <div className={`w-2 h-2 rounded-full ${sc.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase">{agent.agent}</span>
                        <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                      </div>
                      {agent.taskCount > 0 && (
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-white/30">{agent.taskCount} مهمة</span>
                          {agent.avgResponseMs > 0 && (
                            <span className="text-[10px] text-white/20">
                              متوسط الرد: {agent.avgResponseMs < 1000
                                ? `${agent.avgResponseMs}ms`
                                : `${(agent.avgResponseMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Cpu className="w-3.5 h-3.5 text-white/10" />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
