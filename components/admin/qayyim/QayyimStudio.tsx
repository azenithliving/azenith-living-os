'use client';

/**
 * QayyimStudio — الاستوديو الرئيسي لسرب قيّم الدار
 * لوحة موحدة: نظرة عامة، تدقيق، مسودات، تجارب A/B، جودة، مراقبة.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, ShieldCheck, FileText, FlaskConical, Gauge,
  Activity, Sparkles, RefreshCw, Loader2
} from 'lucide-react';
import { QayyimSwarmSidebar } from './QayyimSwarmSidebar';
import { QayyimAuditReport } from './QayyimAuditReport';
import { QayyimDraftPreview } from './QayyimDraftPreview';
import { QayyimExperimentsPanel } from './QayyimExperimentsPanel';
import { QayyimBenchmarksPanel } from './QayyimBenchmarksPanel';
import { QayyimObservabilityDashboard } from './QayyimObservabilityDashboard';
import { QayyimProactiveSuggestions } from './QayyimProactiveSuggestions';
import { QayyimTelemetryPanel } from './QayyimTelemetryPanel';
import { QayyimGoalsPanel } from './QayyimGoalsPanel';
import { QayyimQualityGate } from './QayyimQualityGate';

export type QayyimTab = 'overview' | 'audit' | 'drafts' | 'experiments' | 'benchmarks' | 'observability';

const TABS: Array<{ key: QayyimTab; label: string; icon: any }> = [
  { key: 'overview',       label: 'نظرة عامة',    icon: Brain },
  { key: 'audit',          label: 'التدقيق',      icon: ShieldCheck },
  { key: 'drafts',         label: 'المسودات',     icon: FileText },
  { key: 'experiments',    label: 'التجارب A/B',  icon: FlaskConical },
  { key: 'benchmarks',     label: 'معايير الجودة', icon: Gauge },
  { key: 'observability',  label: 'المراقبة',     icon: Activity },
];

interface StudioStats {
  agents: number;
  activeDrafts: number;
  runningExperiments: number;
  pendingSuggestions: number;
  luxuryScore: number | null;
}

export function QayyimStudio() {
  const [activeTab, setActiveTab] = useState<QayyimTab>('overview');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [draftsRes, expRes, sugRes, luxRes] = await Promise.allSettled([
        fetch('/api/admin/qayyim?action=list_drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
        fetch('/api/admin/qayyim/ab-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'list' }) }).then(r => r.json()),
        fetch('/api/admin/qayyim/suggestions').then(r => r.json()),
        fetch('/api/admin/qayyim/perf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'luxury_score', luxury_scope: 'full_site' }) }).then(r => r.json()),
      ]);

      const drafts = draftsRes.status === 'fulfilled' && draftsRes.value?.success ? (draftsRes.value.drafts || draftsRes.value.result?.drafts || []) : [];
      const experiments = expRes.status === 'fulfilled' && expRes.value?.success ? (expRes.value.experiments || []) : [];
      const suggestions = sugRes.status === 'fulfilled' && sugRes.value?.success ? (sugRes.value.suggestions || []) : [];
      const luxury = luxRes.status === 'fulfilled' && luxRes.value?.success ? luxRes.value.result?.data?.luxury_score ?? null : null;

      setStats({
        agents: 8,
        activeDrafts: drafts.filter((d: any) => d.status === 'draft' || d.status === 'previewing').length,
        runningExperiments: experiments.filter((e: any) => e.status === 'running').length,
        pendingSuggestions: suggestions.filter((s: any) => s.status === 'pending').length,
        luxuryScore: typeof luxury === 'number' ? luxury : (luxury?.total ?? null),
      });
    } catch {
      setStats({ agents: 8, activeDrafts: 0, runningExperiments: 0, pendingSuggestions: 0, luxuryScore: null });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  return (
    <div className="flex h-full min-h-[600px] rounded-2xl border border-white/10 bg-[#0d0d12] overflow-hidden" dir="rtl">
      {/* Swarm sidebar */}
      <QayyimSwarmSidebar
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
      />

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">قيّم الدار — استوديو السرب</h2>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="وكلاء السرب" value={stats?.agents ?? '—'} icon={Brain} tone="amber" />
                <StatCard label="مسودات نشطة" value={stats?.activeDrafts ?? '—'} icon={FileText} tone="sky" />
                <StatCard label="تجارب جارية" value={stats?.runningExperiments ?? '—'} icon={FlaskConical} tone="violet" />
                <StatCard label="اقتراحات معلقة" value={stats?.pendingSuggestions ?? '—'} icon={Sparkles} tone="rose" />
                <StatCard
                  label="Luxury Score"
                  value={stats?.luxuryScore !== null && stats?.luxuryScore !== undefined ? `${stats.luxuryScore}` : '—'}
                  icon={Gauge}
                  tone="emerald"
                />
              </div>

              {/* Proactive suggestions feed */}
              <QayyimProactiveSuggestions />

              {/* Conversion goals managed by QAYYIM-UX */}
              <QayyimGoalsPanel />
            </div>
          )}

          {activeTab === 'audit' && <QayyimAuditReport />}
          {activeTab === 'drafts' && (
            <div className="space-y-4">
              <QayyimQualityGate result={null} />
              <QayyimDraftPreview />
            </div>
          )}
          {activeTab === 'experiments' && <QayyimExperimentsPanel />}
          {activeTab === 'benchmarks' && <QayyimBenchmarksPanel />}
          {activeTab === 'observability' && (
            <div className="space-y-4">
              <QayyimObservabilityDashboard />
              <QayyimTelemetryPanel />
              <LiveEventsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: any; tone: 'amber' | 'sky' | 'violet' | 'rose' | 'emerald' }) {
  const tones: Record<string, string> = {
    amber: 'from-amber-500/15 to-amber-700/5 border-amber-500/20 text-amber-300',
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
          <h3 className="text-sm font-semibold text-white">Live Events</h3>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <span className="text-xs text-white/40">{events.length} events</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 && (
          <div className="text-xs text-white/40 text-center py-8">
            {isConnected ? 'Waiting for events...' : 'Disconnected'}
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
