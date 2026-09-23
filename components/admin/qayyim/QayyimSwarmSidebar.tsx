'use client';

/**
 * QayyimSwarmSidebar — قائمة وكلاء السرب الثمانية مع حالتهم
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Crown, PenLine, Image, Search, MousePointerClick,
  BarChart3, Code2, TestTube2, Loader2
} from 'lucide-react';

interface AgentMeta {
  key: string;
  name: string;
  role: string;
  icon: any;
  color: string;
}

const SWARM_AGENTS: AgentMeta[] = [
  { key: 'qayyim-core', name: 'قيّم كور',        role: 'المنسق الأعلى',      icon: Crown,             color: 'text-amber-300' },
  { key: 'qayyim-cont', name: 'قيّم المحتوى',    role: 'النصوص والهوية',    icon: PenLine,           color: 'text-rose-300' },
  { key: 'qayyim-vis',  name: 'قيّم المرئيات',   role: 'الصور والمعارض',    icon: Image,             color: 'text-violet-300' },
  { key: 'qayyim-seo',  name: 'قيّم SEO',        role: 'الظهور والبحث',     icon: Search,            color: 'text-sky-300' },
  { key: 'qayyim-ux',   name: 'قيّم التجربة',    role: 'سلوك الزوار وA/B',  icon: MousePointerClick, color: 'text-emerald-300' },
  { key: 'qayyim-ana',  name: 'قيّم التحليلات',  role: 'الإيراد والتنبؤ',   icon: BarChart3,         color: 'text-cyan-300' },
  { key: 'qayyim-dev',  name: 'قيّم التطوير',    role: 'الكود والأداء',     icon: Code2,             color: 'text-orange-300' },
  { key: 'qayyim-qa',   name: 'قيّم الجودة',     role: 'الاختبارات الشاملة', icon: TestTube2,        color: 'text-lime-300' },
];

interface AgentActivity {
  agent_key: string;
  last_status: 'completed' | 'failed' | 'started' | null;
  last_at: string | null;
  tasks_24h: number;
}

export function QayyimSwarmSidebar({
  selectedAgent,
  onSelectAgent,
}: {
  selectedAgent: string | null;
  onSelectAgent: (key: string | null) => void;
}) {
  const [activity, setActivity] = useState<Record<string, AgentActivity>>({});
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/qayyim/observability?metric=agent_activity');
      const data = await res.json();
      if (data.success && Array.isArray(data.activity)) {
        const map: Record<string, AgentActivity> = {};
        for (const a of data.activity) map[a.agent_key] = a;
        setActivity(map);
      }
    } catch { /* silent — sidebar works without live data */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchActivity();
    const iv = setInterval(fetchActivity, 60_000);
    return () => clearInterval(iv);
  }, [fetchActivity]);

  return (
    <aside className="w-56 shrink-0 border-l border-white/10 bg-white/[0.02] flex flex-col">
      <div className="px-3.5 py-3 border-b border-white/10">
        <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">وكلاء السرب</div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {SWARM_AGENTS.map((agent) => {
          const Icon = agent.icon;
          const act = activity[agent.key];
          const isSelected = selectedAgent === agent.key;
          return (
            <button
              key={agent.key}
              onClick={() => onSelectAgent(isSelected ? null : agent.key)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-right transition-colors ${
                isSelected ? 'bg-amber-500/15 border border-amber-500/25' : 'hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 ${agent.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{agent.name}</div>
                <div className="text-[10px] text-white/40 truncate">{agent.role}</div>
              </div>
              {/* Status dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  loading
                    ? 'bg-white/20'
                    : act?.last_status === 'failed'
                      ? 'bg-rose-400'
                      : act?.last_status === 'started'
                        ? 'bg-amber-400 animate-pulse'
                        : act?.last_status === 'completed'
                          ? 'bg-emerald-400'
                          : 'bg-white/20'
                }`}
                title={act ? `${act.tasks_24h} مهمة (24 ساعة)` : 'لا نشاط مسجل'}
              />
            </button>
          );
        })}
      </div>

      <div className="px-3.5 py-2.5 border-t border-white/10 text-[10px] text-white/30">
        {loading ? (
          <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> جاري المزامنة…</span>
        ) : (
          <span>النقطة الخضراء = آخر مهمة ناجحة</span>
        )}
      </div>
    </aside>
  );
}
