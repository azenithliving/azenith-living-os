'use client';

/**
 * StudioPanel — الاستوديو الرئيسي لسرب أزينث (P5-M3)
 * 8 كروت وكلاء كمدخل أوحد للمحادثات، وتابات موحّدة:
 * نظرة عامة / العمليات / التحسين / المراقبة.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ShieldCheck, FlaskConical, Gauge, Activity, Sparkles, RefreshCw, Loader2, MessageSquare
} from 'lucide-react';
import { QayyimAuditReport } from './QayyimAuditReport';
import { QayyimDraftPreview } from './QayyimDraftPreview';
import { QayyimExperimentsPanel } from './QayyimExperimentsPanel';
import { QayyimBenchmarksPanel } from './QayyimBenchmarksPanel';
import { QayyimObservabilityDashboard } from './QayyimObservabilityDashboard';
import { QayyimProactiveSuggestions } from './QayyimProactiveSuggestions';
import { QayyimTelemetryPanel } from './QayyimTelemetryPanel';
import { QayyimGoalsPanel } from './QayyimGoalsPanel';
import { QayyimQualityGate } from './QayyimQualityGate';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { AGENT_ROLES } from '@/lib/ops/agent-roles';

export type QayyimTab = 'overview' | 'operations' | 'improvement' | 'monitoring';

const TABS: Array<{ key: QayyimTab; label: string; icon: any; hint: string }> = [
  { key: 'overview',    label: 'نظرة عامة', icon: Brain,      hint: 'صحة السرب الآن: كروت الوكلاء، الأرقام الحية، اقتراحاته المبنية على قياس، وأهدافك.' },
  { key: 'operations',  label: 'العمليات',  icon: ShieldCheck, hint: 'دورة العمل: تقرير التدقيق الشامل ← المسودات وبوابة الجودة ← النشر بموافقتك.' },
  { key: 'improvement', label: 'التحسين',   icon: FlaskConical, hint: 'التجارب المقارنة الجارية ومعايير الجودة التي تُقاس عليها.' },
  { key: 'monitoring',  label: 'المراقبة',  icon: Activity,    hint: 'نبض النظام الحي: لوحة الرصد، تيليمتري الزوار، وأحداث السرب لحظيًا.' },
];

const SWARM: Array<{ key: string; name: string; role: string; icon: string; color: string }> = [
  { key: 'ops-lead', name: 'مدير تشغيل المحتوى',        role: 'تنسيق السرب، تدقيق شامل، نشر/تراجع، بوابة جودة', icon: '👑', color: 'amber' },
  { key: 'ops-content', name: 'المحتوى',       role: 'كتابة فاخرة، توحيد نبرة، قانون هوية',            icon: '✍️', color: 'rose' },
  { key: 'ops-visual',  name: 'المرئيات',      role: 'انتقاء صور، صورة علوية، أوصاف الصور، علامة مميزة',        icon: '🖼️', color: 'violet' },
  { key: 'ops-seo',  name: 'الظهور',  role: 'زحف حقيقي للصفحات، عناوين، بيانات منظمة، فجوات',       icon: '🔍', color: 'sky' },
  { key: 'ops-ux',   name: 'التجربة',       role: 'سلوك زائر، تحويل، تجارب مقارنة',                     icon: '🎯', color: 'emerald' },
  { key: 'ops-analytics',  name: 'التحليلات',     role: 'إيرادات، مؤشر الفخامة، أهداف مهددة',              icon: '📈', color: 'cyan' },
  { key: 'ops-dev',  name: 'التطوير',       role: 'أداء، مسارات الخدمات، جودة الكود',                    icon: '⚡', color: 'orange' },
  { key: 'ops-qa',   name: 'الجودة',        role: 'اختبار حمل حقيقي، رؤوس أمان، إمكانية وصول',       icon: '🧪', color: 'lime' },
];

const TONES: Record<string, string> = {
  amber: 'border-amber-500/25 from-amber-500/10',
  rose: 'border-rose-500/25 from-rose-500/10',
  violet: 'border-violet-500/25 from-violet-500/10',
  sky: 'border-sky-500/25 from-sky-500/10',
  emerald: 'border-emerald-500/25 from-emerald-500/10',
  cyan: 'border-cyan-500/25 from-cyan-500/10',
  orange: 'border-orange-500/25 from-orange-500/10',
  lime: 'border-lime-500/25 from-lime-500/10',
};

interface StudioStats {
  activeDrafts: number;
  runningExperiments: number;
  pendingSuggestions: number;
  luxuryScore: number | null;
}

export function StudioPanel() {
  const [activeTab, setActiveTab] = useState<QayyimTab>('overview');
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [chatAgent, setChatAgent] = useState<string | null>(null);
  const [chatMission, setChatMission] = useState<string | undefined>(undefined);

  const openChat = (key: string, mission?: string) => {
    setChatMission(mission);
    setChatAgent(key);
  };

  const fetchOverview = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [draftsRes, expRes, sugRes, luxRes] = await Promise.allSettled([
        fetch('/api/admin/ops?action=list_drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
        fetch('/api/admin/ops/ab-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }).then(r => r.json()),
        fetch('/api/admin/ops/suggestions').then(r => r.json()),
        fetch('/api/admin/ops/perf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'luxury_score', luxury_scope: 'full_site' }) }).then(r => r.json()),
      ]);

      const drafts = draftsRes.status === 'fulfilled' && draftsRes.value?.success ? (draftsRes.value.drafts || draftsRes.value.result?.drafts || []) : [];
      const experiments = expRes.status === 'fulfilled' && expRes.value?.success ? (expRes.value.experiments || []) : [];
      const suggestions = sugRes.status === 'fulfilled' && sugRes.value?.success ? (sugRes.value.suggestions || []) : [];
      const luxury = luxRes.status === 'fulfilled' && luxRes.value?.success ? luxRes.value.result?.data?.luxury_score ?? null : null;

      setStats({
        activeDrafts: drafts.filter((d: any) => d.status === 'draft' || d.status === 'previewing').length,
        runningExperiments: experiments.filter((e: any) => e.status === 'running').length,
        pendingSuggestions: suggestions.filter((s: any) => s.status === 'pending').length,
        luxuryScore: typeof luxury === 'number' ? luxury : null,
      });
    } catch {
      setStats({ activeDrafts: 0, runningExperiments: 0, pendingSuggestions: 0, luxuryScore: null });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const activeMeta = SWARM.find(a => a.key === chatAgent);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex h-full min-h-[600px] rounded-2xl border border-white/10 bg-[#0d0d12] overflow-hidden">
        {/* Main panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
                <Brain className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">مدير تشغيل المحتوى — استوديو السرب</h2>
                <p className="text-[11px] text-white/50">8 وكلاء متخصصون بدستور واحد وذاكرة مشتركة</p>
              </div>
            </div>
            <button
              onClick={fetchOverview}
              disabled={loadingStats}
              className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
              title="تحديث"
            >
              {loadingStats ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30'
                      : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="px-5 py-2 text-[11px] text-white/40 border-b border-white/5 bg-white/[0.01]">
            {TABS.find(t => t.key === activeTab)?.hint}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Agent cards — the single chat entry point */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {SWARM.map((agent) => (
                    <div key={agent.key} className={`rounded-2xl border bg-gradient-to-br to-transparent p-4 flex flex-col ${TONES[agent.color]}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{agent.icon}</span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white truncate">{agent.name}</h3>
                          <p className="text-[10px] text-white/50 leading-snug">{agent.role}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/35 mt-2">{(AGENT_ROLES[agent.key] || []).length} دورًا حقيقيًا جاهز</p>
                      <div className="flex gap-1.5 mt-3">
                        <button onClick={() => openChat(agent.key)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/80 font-bold">
                          <MessageSquare className="w-3 h-3" /> محادثة
                        </button>
                        <button onClick={() => openChat(agent.key, (AGENT_ROLES[agent.key] || [])[0])} className="flex-1 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-[11px] text-amber-300 font-bold">
                          ⚡ مهمته الأولى
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="مسودات نشطة" value={stats?.activeDrafts ?? '—'} icon={ShieldCheck} tone="sky" />
                  <StatCard label="تجارب جارية" value={stats?.runningExperiments ?? '—'} icon={FlaskConical} tone="violet" />
                  <StatCard label="اقتراحات معلقة" value={stats?.pendingSuggestions ?? '—'} icon={Sparkles} tone="rose" />
                  <StatCard label="مؤشر الفخامة" value={stats?.luxuryScore ?? '—'} icon={Gauge} tone="emerald" />
                </div>

                <QayyimProactiveSuggestions />
                <QayyimGoalsPanel />
              </div>
            )}

            {activeTab === 'operations' && (
              <div className="space-y-4">
                <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50" open>
                  <summary className="cursor-pointer font-bold text-white/70">تدقيق شامل</summary>
                  <div className="mt-3"><QayyimAuditReport /></div>
                </details>
                <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/50" open>
                  <summary className="cursor-pointer font-bold text-white/70">المسودات وبوابة الجودة</summary>
                  <div className="mt-3 space-y-4">
                    <QayyimQualityGate result={null} />
                    <QayyimDraftPreview />
                  </div>
                </details>
              </div>
            )}

            {activeTab === 'improvement' && (
              <div className="space-y-4">
                <QayyimExperimentsPanel />
                <QayyimBenchmarksPanel />
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div className="space-y-4">
                <QayyimObservabilityDashboard />
                <QayyimTelemetryPanel />
                <LiveEventsPanel />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Single chat surface for every agent */}
      {chatAgent && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-4 md:p-6" onClick={() => { setChatAgent(null); setChatMission(undefined); }}>
          <div className="w-full h-full max-w-4xl max-h-[92vh] bg-[#0f0f0f] border border-white/15 rounded-[2rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <ChatPanel
              agentKey={chatAgent}
              agentName={activeMeta?.name}
              agentColor={activeMeta?.color || 'amber'}
              initialMessage={chatMission}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: 'sky' | 'violet' | 'rose' | 'emerald' }) {
  const tones: Record<string, string> = {
    sky: 'from-sky-500/15 to-sky-700/5 border-sky-500/20 text-sky-300',
    violet: 'from-violet-500/15 to-violet-700/5 border-violet-500/20 text-violet-300',
    rose: 'from-rose-500/15 to-rose-700/5 border-rose-500/20 text-rose-300',
    emerald: 'from-emerald-500/15 to-emerald-700/5 border-emerald-500/20 text-emerald-300',
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-white/60">{label}</span>
        <Icon className="w-4 h-4 opacity-70" />
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}

/**
 * Live Events Panel — P3 Proactivity
 * Real-time stream from /api/admin/agents/events/stream
 */
function LiveEventsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource('/api/admin/agents/events/stream');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents(prev => [data, ...prev].slice(0, 30)); // keep latest 30
      } catch {
        // heartbeat or malformed
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">أحداث السرب الحية</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <span className="text-xs text-white/40">{events.length} حدث</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 && (
          <div className="text-xs text-white/40 text-center py-8">
            {isConnected ? 'في انتظار الأحداث...' : 'غير متصل'}
          </div>
        )}

        {events.map((event, idx) => (
          <div key={idx} className="text-xs p-2 rounded bg-white/5 border border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-amber-400">{event.event_type}</span>
              <span className="text-white/40">
                {event.created_at ? new Date(event.created_at).toLocaleTimeString('ar-EG') : ''}
              </span>
            </div>
            <div className="text-white/60">
              من: <span className="text-sky-400">{event.source_agent}</span>
            </div>
            {event.payload && Object.keys(event.payload).length > 0 && (
              <div className="mt-1 text-white/40 truncate">
                {JSON.stringify(event.payload).slice(0, 100)}...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
