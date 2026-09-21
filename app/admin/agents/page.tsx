'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TaskQueue } from '@/components/admin/agents/TaskQueue';
import { CommandConsole } from '@/components/admin/agents/CommandConsole';
import { ApprovalGate } from '@/components/admin/agents/ApprovalGate';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { GroupChatView } from '@/components/admin/agents/GroupChatView';
import { UnifiedAssistant } from '@/components/admin/UnifiedAssistant';
import { ManufacturingDashboard } from '@/components/admin/agents/ManufacturingDashboard';
import { OrderPipeline } from '@/components/admin/agents/OrderPipeline';
import { ProjectGantt } from '@/components/admin/agents/ProjectGantt';
import { QualityCheckPanel } from '@/components/admin/agents/QualityCheckPanel';
import { InventoryManager } from '@/components/admin/agents/InventoryManager';
import { BOMTable } from '@/components/admin/agents/BOMTable';

import { Brain, MessageSquare, ShieldAlert, Activity, Terminal, Sparkles, Factory, Users, Zap, Box, CheckCircle, Calendar, RefreshCw } from 'lucide-react';
import { QuickActionsPanel } from '@/components/admin/agents/QuickActionsPanel';
import { ProactiveSuggestions } from '@/components/admin/agents/ProactiveSuggestions';
import { AgentActionsFeed } from '@/components/admin/agents/AgentActionsFeed';
import { AgentHealthPanel } from '@/components/admin/agents/AgentHealthPanel';
import { EnterprisePipelineBar } from '@/components/admin/agents/EnterprisePipelineBar';
import { EnterpriseScenarioModal } from '@/components/admin/agents/EnterpriseScenarioModal';

type TabType = 'command' | 'assistant' | 'manufacturing' | 'teams';

// ── نوع حالة الوكيل من API ────────────────────────────────────────────
interface AgentStatus {
  agent: string;
  status: 'online' | 'busy' | 'offline';
  taskCount: number;
  recentActivity: string;
}

// ── شريط حالة الوكلاء الحقيقي ────────────────────────────────────────
function AgentStatusBar({ onStatusLoad }: { onStatusLoad?: (s: Record<string, AgentStatus>) => void }) {
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchStatuses = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/agents/chat');
      const data = await res.json();
      if (data.success && data.data) {
        setStatuses(data.data);
        onStatusLoad?.(data.data);
      }
    } catch {
      // صامت
    } finally {
      setLoadingStatus(false);
    }
  }, [onStatusLoad]);

  useEffect(() => {
    fetchStatuses();
    const iv = setInterval(fetchStatuses, 30_000);
    return () => clearInterval(iv);
  }, [fetchStatuses]);

  const statusColor = (s: string) =>
    s === 'online' ? 'bg-emerald-500' :
    s === 'busy'   ? 'bg-amber-500 animate-ping' :
                     'bg-white/20';

  const statusLabel = (s: string) =>
    s === 'online' ? 'متاح' :
    s === 'busy'   ? 'مشغول' : 'غير متاح';

  const agentColor = (key: string) => {
    switch (key) {
      case 'prime':    return { ring: 'border-purple-500/20', bg: 'bg-purple-500/10', text: 'text-purple-400' };
      case 'vanguard': return { ring: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
      case 'analyst':  return { ring: 'border-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-400' };
      case 'coder':    return { ring: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400' };
      case 'ops':      return { ring: 'border-yellow-500/20', bg: 'bg-yellow-500/10', text: 'text-yellow-400' };
      case 'security': return { ring: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' };
      case 'learner':  return { ring: 'border-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-400' };
      default:         return { ring: 'border-white/10', bg: 'bg-white/5', text: 'text-white/60' };
    }
  };

  const agentKeys = ['prime', 'vanguard', 'analyst', 'coder', 'ops', 'security', 'learner'];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {loadingStatus
        ? agentKeys.slice(0, 3).map(k => (
            <div key={k} className="h-9 w-28 bg-white/[0.03] border border-white/5 rounded-xl animate-pulse" />
          ))
        : agentKeys.map(key => {
            const st  = statuses[key];
            const col = agentColor(key);
            return (
              <div key={key} className={`px-3 py-1.5 ${col.bg} border ${col.ring} rounded-xl flex items-center gap-2`}>
                <div className={`w-2 h-2 rounded-full ${statusColor(st?.status ?? 'offline')}`} />
                <span className={`text-xs font-bold ${col.text} uppercase tracking-wider`}>
                  {key.toUpperCase()}
                </span>
                <span className="text-[10px] text-white/30">
                  {st ? `${statusLabel(st.status)} · ${st.taskCount}` : '—'}
                </span>
              </div>
            );
          })
      }
    </div>
  );
}

export default function AgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab]       = useState<TabType>('command');
  const [loading, setLoading]           = useState(false);
  const [showGroupChat, setShowGroupChat]     = useState(false);
  const [activeChatAgent, setActiveChatAgent] = useState<string | null>(null);
  const [showPrimeChat, setShowPrimeChat]     = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [chatInitialMission, setChatInitialMission] = useState<string | undefined>(undefined);

  // إحصائيات التيمز الحقيقية
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [teamStats, setTeamStats]         = useState<{ totalTasks: number; completedToday: number; successRate: number }>({
    totalTasks: 0, completedToday: 0, successRate: 0,
  });
  const [teamLoading, setTeamLoading] = useState(false);

  // Manufacturing sub-tabs
  const [mfgTab, setMfgTab] = useState<'overview' | 'schedule' | 'inventory' | 'quality'>('overview');
  const [metrics, setMetrics] = useState({
    total_orders: 0, in_production: 0, ready: 0,
    delivered: 0,    revenue: 0,       profit: 0,
  });

  // ── قراءة tab من URL ────────────────────────────────────────────────
  useEffect(() => {
    const tab = searchParams?.get('tab') as TabType;
    if (tab && ['command', 'assistant', 'manufacturing', 'teams'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // ── إحصائيات التصنيع ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'manufacturing') return;
    (async () => {
      try {
        const res  = await fetch('/api/admin/owner/dashboard');
        const data = await res.json();
        if (data.success) setMetrics({
          total_orders:  data.data.this_month?.total_orders         || 0,
          in_production: data.data.today?.orders_in_production      || 0,
          ready:         data.data.today?.orders_ready              || 0,
          delivered:     data.data.this_month?.completed_orders     || 0,
          revenue:       data.data.this_month?.total_revenue        || 0,
          profit:        data.data.this_month?.estimated_profit     || 0,
        });
      } catch { /* صامت */ }
    })();
  }, [activeTab]);

  // ── إحصائيات Teams من DB ───────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'teams') return;
    setTeamLoading(true);
    (async () => {
      try {
        // المهام الإجمالية
        const tasksRes  = await fetch('/api/admin/agents/tasks?limit=200');
        const tasksData = await tasksRes.json();
        const tasks: any[] = Array.isArray(tasksData.data) ? tasksData.data : [];

        const today = new Date().toDateString();
        const completedToday = tasks.filter(
          t => t.status === 'completed' && new Date(t.completed_at || t.created_at).toDateString() === today
        ).length;
        const completed  = tasks.filter(t => t.status === 'completed').length;
        const successRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

        setTeamStats({ totalTasks: tasks.length, completedToday, successRate });
      } catch { /* صامت */ }
      finally { setTeamLoading(false); }
    })();
  }, [activeTab]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto bg-[#0A0A0A] min-h-screen text-white">
      {/* Header Intelligence */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full" />
            <div className="relative p-4 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl shadow-2xl">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">مركز الوكلاء الموحّد</h1>
            <p className="text-white/40 mt-1 flex items-center gap-2">
              <Activity className="w-3 h-3 text-emerald-500" />
              كل الوكلاء والمهام والتصنيع في مكان واحد
            </p>
          </div>
        </div>
        {/* ── حالة الوكلاء الحقيقية ── */}
        <AgentStatusBar onStatusLoad={setAgentStatuses} />
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <button
            onClick={() => setActiveTab('command')}
            className={`flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] font-bold transition-all ${
              activeTab === 'command'
                ? 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg scale-[1.02]'
                : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
            }`}
          >
            <Terminal className="w-5 h-5" />
            <span>مركز القيادة</span>
          </button>
          
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] font-bold transition-all ${
              activeTab === 'assistant'
                ? 'bg-gradient-to-br from-[#C5A059] to-[#9D7D3F] text-white shadow-lg scale-[1.02]'
                : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>المساعد الموحّد</span>
          </button>

          <button
            onClick={() => setActiveTab('manufacturing')}
            className={`flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] font-bold transition-all ${
              activeTab === 'manufacturing'
                ? 'bg-gradient-to-br from-blue-600 to-cyan-700 text-white shadow-lg scale-[1.02]'
                : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
            }`}
          >
            <Factory className="w-5 h-5" />
            <span>التصنيع</span>
          </button>

          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center justify-center gap-3 px-6 py-4 rounded-[1.5rem] font-bold transition-all ${
              activeTab === 'teams'
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg scale-[1.02]'
                : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>فريق الوكلاء</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {/* Command Center Tab */}
        {activeTab === 'command' && (
          <>
            {/* Tactical Operations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Intelligence Stream */}
              <div className="space-y-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-1 overflow-hidden shadow-2xl">
                  <TaskQueue />
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-1 overflow-hidden shadow-2xl">
                  <CommandConsole />
                </div>
                {/* اقتراحات استباقية حقيقية */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <ProactiveSuggestions />
                </div>
                {/* صحة النظام */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <AgentHealthPanel />
                </div>
              </div>
              
              {/* Executive Decisions */}
              <div className="space-y-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-1 overflow-hidden shadow-2xl">
                  <ApprovalGate />
                </div>
                
                {/* Quick Actions الحقيقية */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <QuickActionsPanel />
                </div>

                {/* سجل الأحداث الحي */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <AgentActionsFeed />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Unified Assistant Tab */}
        {activeTab === 'assistant' && (
          <div className="-mx-8 -mt-8">
            <UnifiedAssistant />
          </div>
        )}

        {/* Manufacturing Tab */}
        {activeTab === 'manufacturing' && (
          <div className="space-y-6">
            {/* Manufacturing Sub-Tabs */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2">
              <div className="flex gap-2">
                {[
                  { id: 'overview', label: 'نظرة عامة', icon: Zap },
                  { id: 'schedule', label: 'الجدولة', icon: Calendar },
                  { id: 'inventory', label: 'المخزون', icon: Box },
                  { id: 'quality', label: 'فحص الجودة', icon: CheckCircle }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMfgTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-[1.2rem] font-bold text-sm transition-all ${
                      mfgTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Manufacturing Content */}
            {mfgTab === 'overview' && (
              <div className="space-y-6">
                {/* Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <MetricCard title="إجمالي الأوردرات" value={metrics.total_orders.toString()} color="blue" loading={loading} />
                  <MetricCard title="في الإنتاج" value={metrics.in_production.toString()} color="yellow" loading={loading} />
                  <MetricCard title="جاهز للتوصيل" value={metrics.ready.toString()} color="green" loading={loading} />
                  <MetricCard title="تم التسليم" value={metrics.delivered.toString()} color="purple" loading={loading} />
                  <MetricCard title="الإيرادات" value={`${(metrics.revenue / 1000).toFixed(1)}K`} color="indigo" loading={loading} />
                  <MetricCard title="الربح المتوقع" value={`${(metrics.profit / 1000).toFixed(1)}K`} color="teal" loading={loading} />
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                    <ManufacturingDashboard />
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                    <OrderPipeline />
                  </div>
                </div>
              </div>
            )}

            {mfgTab === 'schedule' && (
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                <ProjectGantt />
              </div>
            )}

            {mfgTab === 'inventory' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                  <InventoryManager />
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                  <BOMTable />
                </div>
              </div>
            )}

            {mfgTab === 'quality' && (
              <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-6">
                <QualityCheckPanel />
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="space-y-6">
            {/* إحصائيات سريعة حقيقية */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'إجمالي المهام', value: teamLoading ? '…' : teamStats.totalTasks.toString(), color: 'purple' },
                { label: 'مكتملة اليوم',  value: teamLoading ? '…' : teamStats.completedToday.toString(), color: 'emerald' },
                { label: 'معدل النجاح',   value: teamLoading ? '…' : `${teamStats.successRate}%`, color: 'amber' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border p-5 bg-white/[0.02] ${
                  s.color === 'purple'  ? 'border-purple-500/20'  :
                  s.color === 'emerald' ? 'border-emerald-500/20' :
                                          'border-amber-500/20'
                }`}>
                  <p className="text-xs text-white/40">{s.label}</p>
                  <p className={`text-3xl font-black mt-1 ${
                    s.color === 'purple'  ? 'text-purple-400'  :
                    s.color === 'emerald' ? 'text-emerald-400' :
                                            'text-amber-400'
                  }`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Enterprise Pipeline Bar */}
            <EnterprisePipelineBar onOpenScenarioModal={() => setShowScenarioModal(true)} />

            {/* إحصائيات سريعة حقيقية */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'إجمالي المهام المسجلة', value: teamLoading ? '…' : teamStats.totalTasks.toString(), color: 'purple' },
                { label: 'مهام مكتملة اليوم',  value: teamLoading ? '…' : teamStats.completedToday.toString(), color: 'emerald' },
                { label: 'معدل النجاح الإجمالي',   value: teamLoading ? '…' : `${teamStats.successRate}%`, color: 'amber' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border p-5 bg-white/[0.02] ${
                  s.color === 'purple'  ? 'border-purple-500/20'  :
                  s.color === 'emerald' ? 'border-emerald-500/20' :
                                          'border-amber-500/20'
                }`}>
                  <p className="text-xs text-white/40">{s.label}</p>
                  <p className={`text-3xl font-black mt-1 ${
                    s.color === 'purple'  ? 'text-purple-400'  :
                    s.color === 'emerald' ? 'text-emerald-400' :
                                            'text-amber-400'
                  }`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* بطاقات منظومة الوكلاء السبعة */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-black flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#C5A059]" />
                    منظومة الوكلاء السبعة الميدانية (Autonomous Enterprise Operations)
                  </h2>
                  <p className="text-xs text-white/40 mt-1">
                    كل وكيل يمثل منظومة متكاملة يقرأ معطياته من جداول Postgres ويصدر أوامر تنفيذية حقيقية 100%
                  </p>
                </div>
                <button
                  onClick={() => setShowGroupChat(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg self-start sm:self-auto cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  محادثة جماعية مع الفريق
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {ENTERPRISE_AGENTS.map(agent => {
                  const st = agentStatuses[agent.key];
                  return (
                    <AgentTeamCard
                      key={agent.key}
                      agentKey={agent.key}
                      name={agent.name}
                      role={agent.role}
                      color={agent.color}
                      icon={agent.icon}
                      status={st?.status}
                      taskCount={st?.taskCount}
                      recentActivity={st?.recentActivity}
                      inputs={agent.inputs}
                      outputs={agent.outputs}
                      missions={agent.missions}
                      onChat={() => {
                        setChatInitialMission(undefined);
                        setActiveChatAgent(agent.key);
                      }}
                      onMissionClick={(missionPrompt) => {
                        setChatInitialMission(missionPrompt);
                        setActiveChatAgent(agent.key);
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* غرف العمليات المباشرة PRIME و Vanguard */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div>
                <h3 className="text-base font-black flex items-center gap-2 text-white">
                  <Activity className="w-5 h-5 text-[#C5A059]" />
                  غرف العمليات الميدانية السريعة (Live Field Operations Consoles)
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  قنوات اتصال فوري ومباشر مع كبير الوكلاء التنفيذيين PRIME وقائد العمليات Vanguard لمتابعة المهام اللحظية دون نوافذ منبثقة
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChatPanel agentKey="prime" agentColor="purple" />
                <ChatPanel agentKey="vanguard" agentColor="emerald" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Neural Overlays */}
      {activeChatAgent && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setActiveChatAgent(null)}>
          <div className="w-full max-w-2xl bg-[#111] border border-white/20 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <ChatPanel 
              agentKey={activeChatAgent} 
              initialMessage={chatInitialMission}
            />
          </div>
        </div>
      )}
      {showPrimeChat && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowPrimeChat(false)}>
          <div className="w-full max-w-2xl bg-[#111] border border-purple-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <ChatPanel agentKey="prime" />
          </div>
        </div>
      )}
      {showVanguardChat && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowVanguardChat(false)}>
          <div className="w-full max-w-2xl bg-[#111] border border-emerald-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <ChatPanel agentKey="vanguard" />
          </div>
        </div>
      )}
      {showGroupChat && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowGroupChat(false)}>
          <div className="w-full max-w-4xl bg-[#111] border border-[#C5A059]/30 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <GroupChatView onClose={() => setShowGroupChat(false)} />
          </div>
        </div>
      )}

      {/* Enterprise Scenario Modal */}
      <EnterpriseScenarioModal
        isOpen={showScenarioModal}
        onClose={() => setShowScenarioModal(false)}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
  loading
}: {
  title: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal';
  loading: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400'
  };

  return (
    <div className={`rounded-2xl border p-4 ${colorClasses[color]}`}>
      <p className="text-xs opacity-80">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {loading ? (
          <span className="animate-pulse">--</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

interface EnterpriseAgentConfig {
  key: string;
  name: string;
  role: string;
  color: string;
  icon: string;
  inputs: string[];
  outputs: string[];
  missions: { label: string; prompt: string }[];
}

const ENTERPRISE_AGENTS: EnterpriseAgentConfig[] = [
  {
    key: 'prime',
    name: 'PRIME',
    role: 'كبير مهندسي التصميم والتصنيع الذكي',
    color: 'purple',
    icon: '🧠',
    inputs: ['inventory_items', 'production_jobs', 'sales_orders'],
    outputs: ['كشف المواد BOM', 'حساب الهدر 12%', 'أوامر تشغيل'],
    missions: [
      { label: 'حساب BOM لصالون إمبراطوري', prompt: 'احسب BOM لصالون إمبراطوري' },
      { label: 'فحص مخزون خامات التصنيع', prompt: 'فحص مخزون خامات التصنيع' },
      { label: 'أمر تشغيل جديد بالمصنع', prompt: 'إنشاء أمر تشغيل جديد بالمصنع' },
    ],
  },
  {
    key: 'vanguard',
    name: 'Vanguard',
    role: 'مدير العمليات التجارية ونمو المبيعات',
    color: 'emerald',
    icon: '💼',
    inputs: ['leads', 'sales_orders', 'visitor_telemetry'],
    outputs: ['تأهيل العملاء VIP', 'عقود أوامر البيع', 'تحصيل العربون'],
    missions: [
      { label: 'مسح وتأهيل العملاء الجدد', prompt: 'اعرض قائمة العملاء الجدد ومستويات اهتمامهم' },
      { label: 'تحليل فرص الإيرادات المعلقة', prompt: 'حلل فرص الإيرادات المعلقة في آخر 30 يوماً' },
      { label: 'استعراض أوامر البيع المعتمدة', prompt: 'اعرض أوامر البيع المعتمدة' },
    ],
  },
  {
    key: 'analyst',
    name: 'Analyst',
    role: 'كبير محللي البيانات والجدوى المالية',
    color: 'blue',
    icon: '📊',
    inputs: ['sales_orders', 'inventory_items', 'payments'],
    outputs: ['هوامش الأرباح الصافية', 'مؤشرات الأداء اللحظية', 'توقعات التدفق'],
    missions: [
      { label: 'تحليل هوامش الأرباح الحالية', prompt: 'تحليل هوامش الأرباح الحالية' },
      { label: 'المؤشرات اللحظية في 24 ساعة', prompt: 'المؤشرات اللحظية في 24 ساعة' },
      { label: 'تحليل الإيرادات التراكمية', prompt: 'تحليل الإيرادات' },
    ],
  },
  {
    key: 'coder',
    name: 'Coder',
    role: 'مهندس المنصة والأنظمة البرمجية',
    color: 'cyan',
    icon: '💻',
    inputs: ['مسارات الـ API (182)', 'كود المنظومة', 'اتصالات DB'],
    outputs: ['فحص صحة الـ Endpoints', 'سلامة البنية البرمجية', 'تقارير الأخطاء'],
    missions: [
      { label: 'فحص صحة النظام التقني', prompt: 'فحص صحة النظام التقني' },
      { label: 'فحص مسارات الـ API الرئيسية', prompt: 'فحص مسارات الـ API' },
      { label: 'تدقيق سرعة الاستجابة والأداء', prompt: 'تدقيق سرعة الأداء' },
    ],
  },
  {
    key: 'ops',
    name: 'Ops',
    role: 'مراقب العمليات والبنية التحتية',
    color: 'yellow',
    icon: '⚙️',
    inputs: ['backups', 'system_telemetry', 'cloudflare/cdn'],
    outputs: ['لقطات نسخ احتياطي مشفرة', 'تدقيق سرعة LCP', 'جاهزية 99.9%'],
    missions: [
      { label: 'أخذ نسخة احتياطية فورية', prompt: 'أخذ نسخة احتياطية فورية' },
      { label: 'استعراض سجل النسخ الاحتياطية', prompt: 'استعراض سجل النسخ الاحتياطية' },
      { label: 'تدقيق سرعة الأداء العميقة', prompt: 'تدقيق سرعة الأداء العميقة' },
    ],
  },
  {
    key: 'security',
    name: 'Security',
    role: 'حارس الأمن والامتثال السيبراني',
    color: 'red',
    icon: '🛡️',
    inputs: ['api_keys (1240)', 'immutable_command_log', 'audit_logs'],
    outputs: ['تدقيق صلاحيات المفاتيح', 'كشف الثغرات والـ SQLi', 'شهادة الامتثال'],
    missions: [
      { label: 'فحص مفاتيح الـ API وصلاحياتها', prompt: 'فحص مفاتيح الـ API' },
      { label: 'تدقيق الأمان والامتثال الشامل', prompt: 'تدقيق الأمان والامتثال' },
      { label: 'فحص سجل الأوامر المحصن', prompt: 'فحص سجل الأوامر المحصن' },
    ],
  },
  {
    key: 'learner',
    name: 'Learner',
    role: 'محرك التكيف والتعلم المعرفي الذاتي',
    color: 'indigo',
    icon: '🎓',
    inputs: ['agent_memory', 'agent_cognitive_weights', 'feedback'],
    outputs: ['معايرة أوزان اتخاذ القرار', 'توثيق الخبرات', 'رفع دقة الوكلاء'],
    missions: [
      { label: 'استعراض ذاكرة الوكلاء (DB)', prompt: 'استعراض ذاكرة الوكلاء' },
      { label: 'معايرة الأوزان المعرفية للقرارات', prompt: 'معايرة الأوزان المعرفية' },
      { label: 'تقرير دقة ومعدل نجاح المهام', prompt: 'تقرير دقة القرارات' },
    ],
  },
];

function AgentTeamCard({
  agentKey, name, role, color, icon, status, taskCount, recentActivity,
  inputs, outputs, missions, onChat, onMissionClick
}: {
  agentKey: string; name: string; role: string; color: string; icon: string;
  status?: string; taskCount?: number; recentActivity?: string;
  inputs: string[]; outputs: string[];
  missions: { label: string; prompt: string }[];
  onChat?: () => void;
  onMissionClick?: (prompt: string) => void;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'border-purple-500/30 hover:border-purple-500/60 bg-purple-500/[0.03]',
    emerald: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.03]',
    blue:    'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/[0.03]',
    red:     'border-red-500/30 hover:border-red-500/60 bg-red-500/[0.03]',
    cyan:    'border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/[0.03]',
    yellow:  'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03]',
    indigo:  'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/[0.03]',
  };

  const dotColor =
    status === 'online'  ? 'bg-emerald-500' :
    status === 'busy'    ? 'bg-amber-500 animate-pulse' :
    status === 'offline' ? 'bg-white/20' :
                           'bg-white/10';

  const statusText =
    status === 'online'  ? 'متصل وجاهز' :
    status === 'busy'    ? 'قيد المعالجة' :
    status === 'offline' ? 'غير متاح' : 'نشط';

  return (
    <div className={`border rounded-[2rem] p-5 ${colorClasses[color] || colorClasses.purple} transition-all shadow-xl flex flex-col justify-between space-y-4`}>
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-2xl bg-white/5 border border-white/10">{icon}</span>
            <div>
              <h3 className="font-black text-base text-white">{name}</h3>
              <p className="text-[11px] text-white/50">{role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-[10px] text-white/60 font-mono">{statusText}</span>
          </div>
        </div>

        {/* Inputs & Outputs Tags */}
        <div className="mt-3 space-y-1.5 text-[10px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white/40 font-bold">المعطيات:</span>
            {inputs.map(inp => (
              <span key={inp} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/70 font-mono">
                {inp}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white/40 font-bold">المخرجات:</span>
            {outputs.map(out => (
              <span key={out} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                {out}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* One-Click Real Missions */}
      <div className="space-y-2 pt-3 border-t border-white/10">
        <span className="text-[10px] text-white/40 font-bold flex items-center gap-1">
          <span>⚡</span> مهام تنفيذية فورية (بنقرة واحدة):
        </span>
        <div className="space-y-1.5">
          {missions.map((m, i) => (
            <button
              key={i}
              onClick={() => onMissionClick?.(m.prompt)}
              className="w-full text-right px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white transition-all flex items-center justify-between font-medium cursor-pointer group"
            >
              <span className="truncate">{m.label}</span>
              <span className="text-[10px] text-white/30 group-hover:text-emerald-400 font-mono">تشغيل ➔</span>
            </button>
          ))}
        </div>

        {onChat && (
          <button
            onClick={onChat}
            className="mt-2 w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>💬</span>
            <span>محادثة وتوجيه مخصص</span>
          </button>
        )}
      </div>
    </div>
  );
}
