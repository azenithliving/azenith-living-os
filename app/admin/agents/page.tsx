'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TaskQueue } from '@/components/admin/agents/TaskQueue';
import { CommandConsole } from '@/components/admin/agents/CommandConsole';
import { ApprovalGate } from '@/components/admin/agents/ApprovalGate';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { GroupChatView } from '@/components/admin/agents/GroupChatView';
import { UnifiedAssistant } from '@/components/admin/UnifiedAssistant';

import { Brain, MessageSquare, ShieldAlert, Activity, Terminal, Sparkles, Users, Zap, RefreshCw } from 'lucide-react';
import { QuickActionsPanel } from '@/components/admin/agents/QuickActionsPanel';
import { ProactiveSuggestions } from '@/components/admin/agents/ProactiveSuggestions';
import { AgentActionsFeed } from '@/components/admin/agents/AgentActionsFeed';
import { AgentHealthPanel } from '@/components/admin/agents/AgentHealthPanel';

type TabType = 'command' | 'assistant' | 'teams';

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
      case 'prime':
      case 'qayyim-core': return { ring: 'border-amber-500/20', bg: 'bg-amber-500/10', text: 'text-amber-400' };
      case 'vanguard': return { ring: 'border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-400' };
      case 'analyst':  return { ring: 'border-blue-500/20', bg: 'bg-blue-500/10', text: 'text-blue-400' };
      case 'coder':    return { ring: 'border-cyan-500/20', bg: 'bg-cyan-500/10', text: 'text-cyan-400' };
      case 'ops':      return { ring: 'border-yellow-500/20', bg: 'bg-yellow-500/10', text: 'text-yellow-400' };
      case 'security': return { ring: 'border-red-500/20', bg: 'bg-red-500/10', text: 'text-red-400' };
      case 'learner':  return { ring: 'border-indigo-500/20', bg: 'bg-indigo-500/10', text: 'text-indigo-400' };
      default:         return { ring: 'border-white/10', bg: 'bg-white/5', text: 'text-white/60' };
    }
  };

  const agentKeys = ['qayyim-core', 'vanguard', 'analyst', 'coder', 'ops', 'security', 'learner'];

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
  const [showGroupChat, setShowGroupChat]     = useState(false);
  const [activeChatAgent, setActiveChatAgent] = useState<string | null>(null);
  const [showPrimeChat, setShowPrimeChat]     = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);
  const [chatInitialMission, setChatInitialMission] = useState<string | undefined>(undefined);

  // إحصائيات التيمز الحقيقية
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [teamStats, setTeamStats]         = useState<{ totalTasks: number; completedToday: number; successRate: number }>({
    totalTasks: 0, completedToday: 0, successRate: 0,
  });
  const [teamLoading, setTeamLoading] = useState(false);

  // ── قراءة tab من URL ────────────────────────────────────────────────
  useEffect(() => {
    const tab = searchParams?.get('tab') as TabType | 'manufacturing';
    if (tab === 'manufacturing') {
      setActiveTab('teams');
      return;
    }
    if (tab && ['command', 'assistant', 'teams'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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
              كل الوكلاء والمهام في مكان واحد
            </p>
          </div>
        </div>
        {/* ── حالة الوكلاء الحقيقية ── */}
        <AgentStatusBar onStatusLoad={setAgentStatuses} />
      </div>

      {/* Main Navigation Tabs */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[2rem] p-2">
        <div className="grid grid-cols-3 gap-2">
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

            {/* بطاقات منظومة الوكلاء */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-black flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#C5A059]" />
                    سرب قيّم الدار + الوكلاء الميدانيون
                  </h2>
                  <p className="text-xs text-white/40 mt-1">
                    8 وكلاء قيّم لإطلالة الموقع + 6 وكلاء ميدانيين — يقرأون معطياتهم من Postgres ويصدرون أوامر حقيقية
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <a
                    href="/admin/qayyim"
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    استوديو القيّم
                  </a>
                  <button
                    onClick={() => setShowGroupChat(true)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    محادثة جماعية
                  </button>
                </div>
              </div>

              {/* سرب القيّم — 8 وكلاء */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-amber-400">👑 سرب قيّم الدار</span>
                  <span className="text-[10px] text-white/30 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">8 وكلاء · إطلالة الموقع</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {ENTERPRISE_AGENTS.filter(a => a.key.startsWith('qayyim-')).map(agent => {
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
                        onChat={() => { setChatInitialMission(undefined); setActiveChatAgent(agent.key); }}
                        onMissionClick={(p) => { setChatInitialMission(p); setActiveChatAgent(agent.key); }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* الوكلاء الميدانيون */}
              <div>
                <div className="flex items-center gap-2 mb-3 pt-4 border-t border-white/5">
                  <span className="text-xs font-bold text-white/60">⚙️ الوكلاء الميدانيون</span>
                  <span className="text-[10px] text-white/30 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/10">6 وكلاء · عمليات ومبيعات وأمان</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ENTERPRISE_AGENTS.filter(a => !a.key.startsWith('qayyim-')).map(agent => {
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
                        onChat={() => { setChatInitialMission(undefined); setActiveChatAgent(agent.key); }}
                        onMissionClick={(p) => { setChatInitialMission(p); setActiveChatAgent(agent.key); }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* غرف العمليات المباشرة — قيّم الدار و Vanguard */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 space-y-6">
              <div>
                <h3 className="text-base font-black flex items-center gap-2 text-white">
                  <Activity className="w-5 h-5 text-[#C5A059]" />
                  غرف العمليات الميدانية السريعة
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  قناة اتصال فوري مع قائد سرب القيّم ووكيل العمليات Vanguard — تنفيذ مهام لحظية بلا نوافذ منبثقة
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChatPanel agentKey="qayyim-core" agentName="قيّم الدار — القائد" agentColor="amber" />
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
              agentName={activeChatAgent === 'qayyim-core' || activeChatAgent === 'prime' ? 'قيّم الدار — القائد' : undefined}
              initialMessage={chatInitialMission}
            />
          </div>
        </div>
      )}
      {showPrimeChat && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowPrimeChat(false)}>
          <div className="w-full max-w-2xl bg-[#111] border border-amber-500/30 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <ChatPanel agentKey="qayyim-core" agentName="قيّم الدار — القائد" agentColor="amber" />
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
  // ════════════════════════════════════════════════════════════
  // سرب قيّم الدار — 8 وكلاء إطلالة الموقع
  // ════════════════════════════════════════════════════════════
  {
    key: 'qayyim-core',
    name: 'قيّم الدار — القائد',
    role: 'قائد السرب: تنسيق، تدقيق شامل، نشر/تراجع، بوابة جودة',
    color: 'amber',
    icon: '👑',
    inputs: ['room_sections', 'products', 'qayyim_drafts', 'visitor_telemetry'],
    outputs: ['تقرير تدقيق شامل', 'مسودات منسقة', 'نشر/تراجع بموافقة'],
    missions: [
      { label: 'افحص الموقع كله شاملاً',     prompt: 'افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً' },
      { label: 'نسّق السرب للرئيسية',         prompt: 'نسّق السرب لتحسين الصفحة الرئيسية كاملاً' },
      { label: 'اعرض المسودات المعلقة',       prompt: 'اعرض المسودات المعلقة للمراجعة والنشر' },
    ],
  },
  {
    key: 'qayyim-cont',
    name: 'قيّم الدار — المحتوى',
    role: 'كتابة فاخرة، توحيد نبرة، قانون هوية، صقل نصوص',
    color: 'rose',
    icon: '✍️',
    inputs: ['room_sections', 'products', 'site_sections'],
    outputs: ['نصوص عربية فاخرة', 'توحيد نبرة', 'تقرير مخالفات هوية'],
    missions: [
      { label: 'افحص هوية النصوص',            prompt: 'افحص هوية النصوص على جميع صفحات الموقع' },
      { label: 'صغ نصاً فاخراً للهيرو',      prompt: 'صغ نصاً فاخراً يعكس هوية أزينث للهيرو' },
      { label: 'وحّد نبرة الأقسام',           prompt: 'وحّد نبرة الكتابة في جميع أقسام الموقع' },
    ],
  },
  {
    key: 'qayyim-vis',
    name: 'قيّم الدار — المرئيات',
    role: 'انتقاء صور، هيرو، alt text، اتساق علامة تجارية',
    color: 'violet',
    icon: '🖼️',
    inputs: ['curated_images', 'products', 'room_sections'],
    outputs: ['معرض منتقى', 'صورة هيرو مختارة', 'alt text غني'],
    missions: [
      { label: 'فحص صور المنتجات',           prompt: 'افحص صور المنتجات وقيّم جودتها واتساقها' },
      { label: 'اقترح صورة هيرو',            prompt: 'اقترح صورة هيرو تعكس فخامة أزينث' },
      { label: 'أنشئ alt text للصور',        prompt: 'أنشئ alt text احترافي لجميع صور الموقع' },
    ],
  },
  {
    key: 'qayyim-seo',
    name: 'قيّم الدار — الظهور',
    role: 'تدقيق SEO تقني، Schema.org، فجوات محتوى، منافسين',
    color: 'sky',
    icon: '🔍',
    inputs: ['products', 'room_sections', 'site_sections'],
    outputs: ['تقرير SEO تقني', 'Schema.org مُصلح', 'تحليل فجوات'],
    missions: [
      { label: 'تدقيق SEO للموقع',           prompt: 'قم بتدقيق SEO شامل وتقني للموقع' },
      { label: 'أصلح Schema.org',             prompt: 'أصلح Schema.org للمنتجات والصفحات' },
      { label: 'تحليل فجوات المحتوى',        prompt: 'حلل فجوات المحتوى مقارنة بالمنافسين' },
    ],
  },
  {
    key: 'qayyim-ux',
    name: 'قيّم الدار — التجربة',
    role: 'سلوك زوار، معدل تحويل، A/B testing، تحليل خروج',
    color: 'emerald',
    icon: '🎯',
    inputs: ['qayyim_telemetry_events', 'visitor_telemetry', 'qayyim_experiments'],
    outputs: ['تقرير سلوك زوار', 'اقتراحات A/B', 'تحليل معدل خروج'],
    missions: [
      { label: 'تحليل سلوك الزوار',          prompt: 'حلل سلوك الزوار ومعدلات الخروج من الصفحات' },
      { label: 'اقترح A/B test للهيرو',      prompt: 'اقترح A/B test محدد لتحسين هيرو الصفحة الرئيسية' },
      { label: 'فحص معدل التحويل',           prompt: 'افحص معدل التحويل الحالي وحدد نقاط الضعف' },
    ],
  },
  {
    key: 'qayyim-ana',
    name: 'قيّم الدار — التحليلات',
    role: 'ربط تحويل بإيرادات، Luxury Score، تنبؤ، تقسيم عملاء',
    color: 'cyan',
    icon: '📈',
    inputs: ['visitor_telemetry', 'qayyim_telemetry_events', 'qayyim_experiments'],
    outputs: ['Luxury Score', 'تنبؤ تحويل', 'تقرير أعمال أسبوعي'],
    missions: [
      { label: 'احسب Luxury Score',           prompt: 'احسب Luxury Score الحالي للموقع' },
      { label: 'ربط التحويل بالإيرادات',     prompt: 'حلل العلاقة بين معدل التحويل والإيرادات' },
      { label: 'تقرير أداء الأعمال',         prompt: 'أعطني تقرير أداء الأعمال للأسبوع الماضي' },
    ],
  },
  {
    key: 'qayyim-dev',
    name: 'قيّم الدار — التطوير',
    role: 'Core Web Vitals، bundle، جودة كود، dependency check',
    color: 'orange',
    icon: '⚡',
    inputs: ['كود المنظومة', 'bundle stats', 'npm dependencies'],
    outputs: ['تقرير Core Web Vitals', 'تحليل bundle', 'code quality gate'],
    missions: [
      { label: 'تدقيق Core Web Vitals',      prompt: 'تدقيق Core Web Vitals والأداء' },
      { label: 'فحص bundle size',            prompt: 'فحص bundle size وتحديد الملفات الكبيرة' },
      { label: 'مراجعة جودة الكود',          prompt: 'مراجعة جودة الكود وبوابة الجودة' },
    ],
  },
  {
    key: 'qayyim-qa',
    name: 'قيّم الدار — الجودة',
    role: 'E2E smoke tests، visual regression، a11y، load test',
    color: 'lime',
    icon: '🧪',
    inputs: ['صفحات الموقع', 'staging environment'],
    outputs: ['تقرير E2E', 'visual regression', 'تقرير إمكانية الوصول'],
    missions: [
      { label: 'تشغيل E2E smoke tests',      prompt: 'تشغيل E2E smoke tests على الصفحات الرئيسية' },
      { label: 'فحص إمكانية الوصول',         prompt: 'فحص إمكانية الوصول WCAG 2.1 للموقع' },
      { label: 'visual regression',           prompt: 'تشغيل visual regression للصفحة الرئيسية' },
    ],
  },
  // ════════════════════════════════════════════════════════════
  // وكلاء العمليات الميدانية
  // ════════════════════════════════════════════════════════════
  {
    key: 'vanguard',
    name: 'Vanguard',
    role: 'مدير العمليات التجارية ونمو المبيعات',
    color: 'emerald',
    icon: '💼',
    inputs: ['leads', 'sales_orders', 'visitor_telemetry'],
    outputs: ['تأهيل العملاء VIP', 'عقود أوامر البيع', 'تحصيل العربون'],
    missions: [
      { label: 'مسح وتأهيل العملاء الجدد',   prompt: 'اعرض قائمة العملاء الجدد ومستويات اهتمامهم' },
      { label: 'تحليل فرص الإيرادات',        prompt: 'حلل فرص الإيرادات المعلقة في آخر 30 يوماً' },
      { label: 'أوامر البيع المعتمدة',       prompt: 'اعرض أوامر البيع المعتمدة' },
    ],
  },
  {
    key: 'analyst',
    name: 'Analyst',
    role: 'كبير محللي البيانات والجدوى المالية',
    color: 'blue',
    icon: '📊',
    inputs: ['sales_orders', 'payments', 'visitor_telemetry'],
    outputs: ['هوامش الأرباح الصافية', 'مؤشرات الأداء اللحظية', 'توقعات التدفق'],
    missions: [
      { label: 'تحليل هوامش الأرباح',        prompt: 'تحليل هوامش الأرباح الحالية' },
      { label: 'المؤشرات اللحظية',            prompt: 'المؤشرات اللحظية في 24 ساعة' },
      { label: 'تحليل الإيرادات',            prompt: 'تحليل الإيرادات' },
    ],
  },
  {
    key: 'coder',
    name: 'Coder',
    role: 'مهندس المنصة والأنظمة البرمجية',
    color: 'cyan',
    icon: '💻',
    inputs: ['مسارات الـ API', 'كود المنظومة', 'اتصالات DB'],
    outputs: ['فحص صحة الـ Endpoints', 'سلامة البنية البرمجية', 'تقارير الأخطاء'],
    missions: [
      { label: 'فحص صحة النظام التقني',      prompt: 'فحص صحة النظام التقني' },
      { label: 'فحص مسارات الـ API',         prompt: 'فحص مسارات الـ API' },
      { label: 'تدقيق سرعة الاستجابة',       prompt: 'تدقيق سرعة الأداء' },
    ],
  },
  {
    key: 'ops',
    name: 'Ops',
    role: 'مراقب العمليات والبنية التحتية',
    color: 'yellow',
    icon: '⚙️',
    inputs: ['backups', 'system_telemetry', 'cloudflare/cdn'],
    outputs: ['لقطات نسخ احتياطي', 'تدقيق LCP', 'جاهزية 99.9%'],
    missions: [
      { label: 'أخذ نسخة احتياطية فورية',    prompt: 'أخذ نسخة احتياطية فورية' },
      { label: 'سجل النسخ الاحتياطية',       prompt: 'استعراض سجل النسخ الاحتياطية' },
      { label: 'تدقيق سرعة الأداء',          prompt: 'تدقيق سرعة الأداء العميقة' },
    ],
  },
  {
    key: 'security',
    name: 'Security',
    role: 'حارس الأمن والامتثال السيبراني',
    color: 'red',
    icon: '🛡️',
    inputs: ['api_keys', 'immutable_command_log', 'audit_logs'],
    outputs: ['تدقيق صلاحيات المفاتيح', 'كشف الثغرات', 'شهادة الامتثال'],
    missions: [
      { label: 'فحص مفاتيح الـ API',         prompt: 'فحص مفاتيح الـ API' },
      { label: 'تدقيق الأمان والامتثال',     prompt: 'تدقيق الأمان والامتثال' },
      { label: 'فحص سجل الأوامر المحصن',    prompt: 'فحص سجل الأوامر المحصن' },
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
      { label: 'استعراض ذاكرة الوكلاء',      prompt: 'استعراض ذاكرة الوكلاء' },
      { label: 'معايرة الأوزان المعرفية',     prompt: 'معايرة الأوزان المعرفية' },
      { label: 'تقرير دقة القرارات',          prompt: 'تقرير دقة القرارات' },
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
    purple:  'border-purple-500/30 hover:border-purple-500/60 bg-purple-500/[0.03]',
    emerald: 'border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/[0.03]',
    blue:    'border-blue-500/30 hover:border-blue-500/60 bg-blue-500/[0.03]',
    red:     'border-red-500/30 hover:border-red-500/60 bg-red-500/[0.03]',
    cyan:    'border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/[0.03]',
    yellow:  'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03]',
    amber:   'border-amber-500/30 hover:border-amber-500/60 bg-amber-500/[0.03]',
    indigo:  'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/[0.03]',
    rose:    'border-rose-500/30 hover:border-rose-500/60 bg-rose-500/[0.03]',
    violet:  'border-violet-500/30 hover:border-violet-500/60 bg-violet-500/[0.03]',
    sky:     'border-sky-500/30 hover:border-sky-500/60 bg-sky-500/[0.03]',
    orange:  'border-orange-500/30 hover:border-orange-500/60 bg-orange-500/[0.03]',
    lime:    'border-lime-500/30 hover:border-lime-500/60 bg-lime-500/[0.03]',
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
