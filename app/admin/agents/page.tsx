'use client';

import { useState, useEffect } from 'react';
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

import Link from 'next/link';
import { Brain, Cpu, MessageSquare, ShieldAlert, Activity, LayoutGrid, Terminal, Sparkles, Factory, Users, Zap, Box, CheckCircle, Calendar } from 'lucide-react';

type TabType = 'command' | 'assistant' | 'manufacturing' | 'teams';

export default function AgentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('command');
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [showPrimeChat, setShowPrimeChat] = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);
  
  // Manufacturing sub-tabs
  const [mfgTab, setMfgTab] = useState<'overview' | 'schedule' | 'inventory' | 'quality'>('overview');
  const [metrics, setMetrics] = useState({
    total_orders: 0,
    in_production: 0,
    ready: 0,
    delivered: 0,
    revenue: 0,
    profit: 0
  });

  useEffect(() => {
    const tab = searchParams?.get('tab') as TabType;
    if (tab && ['command', 'assistant', 'manufacturing', 'teams'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    async function getDevices() {
      try {
        const res = await fetch('/api/admin/agents/devices');
        const data = await res.json();
        setDevices(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error("Failed to fetch devices:", error);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const response = await fetch('/api/admin/owner/dashboard?company_id=demo');
        const data = await response.json();
        if (data.success) {
          setMetrics({
            total_orders: data.data.this_month?.total_orders || 0,
            in_production: data.data.today?.orders_in_production || 0,
            ready: data.data.today?.orders_ready || 0,
            delivered: data.data.this_month?.completed_orders || 0,
            revenue: data.data.this_month?.total_revenue || 0,
            profit: data.data.this_month?.estimated_profit || 0
          });
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    }

    if (activeTab === 'manufacturing') {
      loadMetrics();
    }
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
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">PRIME Online</span>
          </div>
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Vanguard Ready</span>
          </div>
        </div>
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
              </div>
              
              {/* Executive Decisions */}
              <div className="space-y-8">
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-1 overflow-hidden shadow-2xl">
                  <ApprovalGate />
                </div>
                
                {/* Quick Command Matrix */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#C5A059]/5 blur-3xl rounded-full" />
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-[#C5A059]" />
                    مصفوفة الأوامر السريعة
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setShowPrimeChat(true)}
                      className="group flex flex-col items-center justify-center p-6 bg-purple-500/5 border border-purple-500/10 rounded-3xl hover:bg-purple-500/20 transition-all gap-3"
                    >
                      <Brain className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">مخاطبة PRIME</span>
                    </button>
                    <button 
                      onClick={() => setShowVanguardChat(true)}
                      className="group flex flex-col items-center justify-center p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl hover:bg-emerald-500/20 transition-all gap-3"
                    >
                      <MessageSquare className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">مخاطبة Vanguard</span>
                    </button>
                    <button 
                      onClick={() => setShowGroupChat(true)}
                      className="group flex flex-col items-center justify-center p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl hover:bg-blue-500/20 transition-all gap-3"
                    >
                      <LayoutGrid className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">مؤتمر الوكلاء</span>
                    </button>
                    <button 
                      onClick={async () => {
                        if (!confirm('🛑 بروتوكول الإيقاف الطارئ سيعطل كافة العمليات. هل أنت متأكد؟')) return;
                        try {
                          await fetch('/api/admin/owner/emergency-stop', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'trigger', reason: 'Critical Override from Agents Matrix' })
                          });
                          alert('🛑 تم تنشيط البروتوكول بنجاح.');
                        } catch {
                          alert('❌ خطأ في الاتصال بالأمن المركزي.');
                        }
                      }}
                      className="group flex flex-col items-center justify-center p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl hover:bg-rose-500 transition-all gap-3"
                    >
                      <ShieldAlert className="w-6 h-6 text-rose-500 group-hover:text-white transition-colors" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-300 group-hover:text-white">إيقاف سيادي</span>
                    </button>
                  </div>
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
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 text-center">
              <Users className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">فريق الوكلاء السبعة</h2>
              <p className="text-white/60 mb-6">إدارة كل الوكلاء وتنسيق العمل بينهم</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AgentTeamCard name="PRIME" role="مهندس التصميم" color="purple" icon="🧠" />
                <AgentTeamCard name="Vanguard" role="مدير المبيعات" color="emerald" icon="💼" />
                <AgentTeamCard name="Architect" role="معماري النظام" color="blue" icon="🏗️" />
                <AgentTeamCard name="Guardian" role="حارس الأمن" color="red" icon="🛡️" />
                <AgentTeamCard name="Oracle" role="محلل البيانات" color="cyan" icon="🔮" />
                <AgentTeamCard name="Nexus" role="منسق العمليات" color="yellow" icon="⚡" />
                <AgentTeamCard name="Sage" role="مستشار الحكمة" color="indigo" icon="📚" />
              </div>
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

function AgentTeamCard({ name, role, color, icon }: { name: string; role: string; color: string; icon: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'border-purple-500/30 hover:bg-purple-500/10',
    emerald: 'border-emerald-500/30 hover:bg-emerald-500/10',
    blue: 'border-blue-500/30 hover:bg-blue-500/10',
    red: 'border-red-500/30 hover:bg-red-500/10',
    cyan: 'border-cyan-500/30 hover:bg-cyan-500/10',
    yellow: 'border-yellow-500/30 hover:bg-yellow-500/10',
    indigo: 'border-indigo-500/30 hover:bg-indigo-500/10',
  };

  return (
    <div className={`border rounded-2xl p-6 bg-white/[0.02] ${colorClasses[color]} transition-all cursor-pointer`}>
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-bold text-lg">{name}</h3>
      <p className="text-sm text-white/60 mt-1">{role}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-white/40">نشط</span>
      </div>
    </div>
  );
}
