'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DeviceCard } from '@/components/admin/agents/DeviceCard';
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

import { Brain, Cpu, MessageSquare, ShieldAlert, Activity, LayoutGrid, Terminal, Sparkles, Factory, Users, Zap, Box, CheckCircle, Calendar, RefreshCw } from 'lucide-react';
import { QuickActionsPanel } from '@/components/admin/agents/QuickActionsPanel';
import { ProactiveSuggestions } from '@/components/admin/agents/ProactiveSuggestions';
import { AgentActionsFeed } from '@/components/admin/agents/AgentActionsFeed';
import { AgentHealthPanel } from '@/components/admin/agents/AgentHealthPanel';

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

  const agentColor = (key: string) =>
    key === 'prime' ? { ring: 'border-purple-500/20', bg: 'bg-purple-500/10', text: 'text-purple-400' }
                    : { ring: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {loadingStatus
        ? ['prime', 'vanguard'].map(k => (
            <div key={k} className="h-9 w-36 bg-white/[0.03] border border-white/5 rounded-xl animate-pulse" />
          ))
        : ['prime', 'vanguard'].map(key => {
            const st  = statuses[key];
            const col = agentColor(key);
            return (
              <div key={key} className={`px-4 py-2 ${col.bg} border ${col.ring} rounded-xl flex items-center gap-2`}>
                <div className={`w-2 h-2 rounded-full ${statusColor(st?.status ?? 'offline')}`} />
                <span className={`text-xs font-bold ${col.text} uppercase tracking-widest`}>
                  {key.toUpperCase()}
                </span>
                <span className="text-[10px] text-white/30">
                  {st ? `${statusLabel(st.status)} · ${st.taskCount} مهمة` : '—'}
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
  const [devices, setDevices]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showGroupChat, setShowGroupChat]     = useState(false);
  const [showPrimeChat, setShowPrimeChat]     = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);

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

  // ── جلب الأجهزة ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/admin/agents/devices');
        const data = await res.json();
        setDevices(Array.isArray(data.data) ? data.data : []);
      } catch { setDevices([]); }
      finally  { setLoading(false); }
    })();
  }, []);

  // ── إحصائيات التصنيع ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'manufacturing') return;
    (async () => {
      try {
        const res  = await fetch('/api/admin/owner/dashboard?company_id=demo');
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
            {/* Neural Infrastructure Grid */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <LayoutGrid className="w-4 h-4 text-[#C5A059]" />
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-[#C5A059]">البنية التحتية العصبية (Devices)</h2>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-44 bg-white/[0.02] border border-white/5 animate-pulse rounded-[2rem]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {devices.map((device: any) => (
                    <div key={device.id} className="transition-all hover:scale-[1.02]">
                      <DeviceCard device={device} />
                    </div>
                  ))}
                  {devices.length === 0 && (
                    <div className="col-span-full p-12 text-center bg-white/[0.02] border border-white/5 border-dashed rounded-[2.5rem] group hover:border-[#C5A059]/30 transition-all">
                      <div className="w-16 h-16 bg-white/[0.03] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-[#C5A059]/10">
                        <Cpu className="w-8 h-8 text-white/20 group-hover:text-[#C5A059] transition-colors" />
                      </div>
                      <p className="text-white/60 font-bold">لا توجد أجهزة متصلة بالشبكة العصبية</p>
                      <code className="text-[10px] text-white/20 mt-2 block font-mono bg-black/40 px-3 py-1 rounded inline-block">
                        docker-compose up -d
                      </code>
                    </div>
                  )}
                </div>
              )}
            </section>
            
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
          <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden">
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

            {/* بطاقات الوكلاء */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8">
              <h2 className="text-lg font-black mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C5A059]" />
                فريق الوكلاء السبعة
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'prime',    name: 'PRIME',    role: 'مهندس التصميم والتطوير', color: 'purple', icon: '🧠', canChat: true  },
                  { key: 'vanguard', name: 'Vanguard', role: 'مدير العمليات والمبيعات', color: 'emerald', icon: '💼', canChat: true  },
                  { key: 'analyst',  name: 'Analyst',  role: 'محلل البيانات والتقارير', color: 'blue',   icon: '📊', canChat: false },
                  { key: 'coder',    name: 'Coder',    role: 'مطور الكود والتقنية',    color: 'cyan',   icon: '💻', canChat: false },
                  { key: 'ops',      name: 'Ops',      role: 'مراقب العمليات والنظام',  color: 'yellow', icon: '⚙️', canChat: false },
                  { key: 'security', name: 'Security', role: 'حارس الأمن والتدقيق',   color: 'red',    icon: '🛡️', canChat: false },
                  { key: 'learner',  name: 'Learner',  role: 'محرك التعلم الذاتي',     color: 'indigo', icon: '🎓', canChat: false },
                ].map(agent => {
                  const st = agentStatuses[agent.key];
                  return (
                    <AgentTeamCard
                      key={agent.key}
                      name={agent.name}
                      role={agent.role}
                      color={agent.color}
                      icon={agent.icon}
                      status={st?.status}
                      taskCount={st?.taskCount}
                      recentActivity={st?.recentActivity}
                      onChat={agent.canChat
                        ? () => agent.key === 'prime' ? setShowPrimeChat(true) : setShowVanguardChat(true)
                        : undefined}
                    />
                  );
                })}
              </div>
            </div>

            {/* محادثة مباشرة PRIME */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChatPanel agentKey="prime" agentColor="purple" />
              <ChatPanel agentKey="vanguard" agentColor="emerald" />
            </div>
          </div>
        )}
      </div>

      {/* Chat Neural Overlays */}
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

function AgentTeamCard({
  name, role, color, icon, status, taskCount, recentActivity, onChat
}: {
  name: string; role: string; color: string; icon: string;
  status?: string; taskCount?: number; recentActivity?: string;
  onChat?: () => void;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'border-purple-500/30 hover:bg-purple-500/10',
    emerald: 'border-emerald-500/30 hover:bg-emerald-500/10',
    blue:    'border-blue-500/30 hover:bg-blue-500/10',
    red:     'border-red-500/30 hover:bg-red-500/10',
    cyan:    'border-cyan-500/30 hover:bg-cyan-500/10',
    yellow:  'border-yellow-500/30 hover:bg-yellow-500/10',
    indigo:  'border-indigo-500/30 hover:bg-indigo-500/10',
  };

  const dotColor =
    status === 'online'  ? 'bg-emerald-500' :
    status === 'busy'    ? 'bg-amber-500 animate-pulse' :
    status === 'offline' ? 'bg-white/20' :
                           'bg-white/10';

  const statusText =
    status === 'online'  ? 'متاح' :
    status === 'busy'    ? 'مشغول' :
    status === 'offline' ? 'غير متاح' : 'جاري التحقق…';

  return (
    <div className={`border rounded-2xl p-5 bg-white/[0.02] ${colorClasses[color] ?? colorClasses.purple} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-[10px] text-white/40">{statusText}</span>
        </div>
      </div>
      <h3 className="font-bold text-base">{name}</h3>
      <p className="text-xs text-white/50 mt-0.5">{role}</p>
      {taskCount !== undefined && (
        <div className="mt-3 flex items-center gap-3 text-[10px] text-white/30">
          <span>المهام: <strong className="text-white/60">{taskCount}</strong></span>
          {recentActivity && recentActivity !== 'لا يوجد نشاط حديث' && recentActivity !== 'غير متاح' && (
            <span className="truncate">
              آخر نشاط: {new Date(recentActivity).toLocaleDateString('ar-EG')}
            </span>
          )}
        </div>
      )}
      {onChat && (
        <button
          onClick={onChat}
          className="mt-3 w-full py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all font-bold"
        >
          💬 تكلم
        </button>
      )}
    </div>
  );
}
