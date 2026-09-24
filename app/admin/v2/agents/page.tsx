'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { GroupChatView } from '@/components/admin/agents/GroupChatView';
import { Brain, MessageSquare, Users, Sparkles, Activity } from 'lucide-react';
import Link from 'next/link';

type AgentStatus = { agent: string; status: 'online' | 'busy' | 'offline'; taskCount: number; recentActivity: string };

export default function V2AgentsPage() {
  const [activeChatAgent, setActiveChatAgent] = useState<string | null>(null);
  const [chatInitialMission, setChatInitialMission] = useState<string | undefined>(undefined);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [teamStats, setTeamStats] = useState({ totalTasks: 0, completedToday: 0, successRate: 0 });
  const [teamLoading, setTeamLoading] = useState(false);
  const [qayyimStats, setQayyimStats] = useState<{ drafts: number; luxuryScore: number | null; lastAudit: string | null }>({ drafts: 0, luxuryScore: null, lastAudit: null });
  const [unread, setUnread] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents/chat');
      const data = await res.json();
      if (data.success && data.data?.['qayyim-core']) setAgentStatus(data.data['qayyim-core']);
    } catch {}
  }, []);
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents/messages?agent_key=qayyim-core&unread=true');
      const data = await res.json();
      if (data.success) setUnread(data.count || 0);
    } catch {}
  }, []);
  useEffect(() => { fetchStatus(); fetchUnread(); const iv = setInterval(() => { fetchStatus(); fetchUnread(); }, 30000); return () => clearInterval(iv); }, [fetchStatus, fetchUnread]);

  useEffect(() => {
    setTeamLoading(true);
    (async () => {
      try {
        const [tasksRes, draftsRes, luxRes] = await Promise.allSettled([
          fetch('/api/admin/agents/tasks?status=all&limit=200').then(r=>r.json()),
          fetch('/api/admin/qayyim?action=list_drafts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({}) }).then(r=>r.json()),
          fetch('/api/admin/qayyim/perf', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'luxury_score', luxury_scope:'full_site' }) }).then(r=>r.json()),
        ]);
        const tasks: any[] = tasksRes.status==='fulfilled' && Array.isArray(tasksRes.value.tasks) ? tasksRes.value.tasks : [];
        const counts = tasksRes.status==='fulfilled' && tasksRes.value.counts ? tasksRes.value.counts : null;
        const today = new Date().toDateString();
        const completedToday = tasks.filter(t => t.status==='completed' && new Date(t.completed_at||t.created_at).toDateString()===today).length;
        const completed = counts?.completed ?? tasks.filter(t=>t.status==='completed').length;
        const failed = counts?.failed ?? tasks.filter(t=>t.status==='failed').length;
        const successRate = (completed+failed)>0?Math.round((completed/(completed+failed))*100):0;
        setTeamStats({ totalTasks: counts?.total ?? tasks.length, completedToday, successRate });
        const drafts = draftsRes.status==='fulfilled' && draftsRes.value?.success ? (draftsRes.value.drafts||draftsRes.value.result?.drafts||[]) : [];
        const activeDrafts = drafts.filter((d:any)=>d.status==='draft'||d.status==='previewing').length;
        const luxuryScore = luxRes.status==='fulfilled' && luxRes.value?.success ? luxRes.value.result?.data?.luxury_score ?? null : null;
        setQayyimStats({ drafts: activeDrafts, luxuryScore, lastAudit: tasks.find((t:any)=>t.task_type?.includes('audit'))?.created_at||null });
      } catch {}
      finally{ setTeamLoading(false); }
    })();
  }, []);

  const statusText = agentStatus?.status === 'online' ? 'متصل وجاهز' : agentStatus?.status === 'busy' ? 'قيد المعالجة' : agentStatus?.status === 'offline' ? 'غير متاح' : 'نشط';
  const dotColor = agentStatus?.status === 'online' ? 'bg-emerald-500' : agentStatus?.status === 'busy' ? 'bg-amber-500 animate-pulse' : 'bg-white/20';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto min-h-screen" dir="rtl">
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full" />
          <div className="relative p-4 bg-gradient-to-br from-amber-600 to-yellow-700 rounded-2xl">
            <Brain className="w-8 h-8 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">مركز قيادة الوكلاء</h1>
          <p className="text-white/40 mt-1 text-xs">قيّم الدار كيان واحد — 8 وكلاء في كارت واحد — باقي الصفحة فاضية لنقل القديم</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي المهام', value: teamLoading ? '…' : teamStats.totalTasks.toString(), color: 'purple' },
          { label: 'مكتملة اليوم', value: teamLoading ? '…' : teamStats.completedToday.toString(), color: 'emerald' },
          { label: 'معدل النجاح', value: teamLoading ? '…' : `${teamStats.successRate}%`, color: 'amber' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-5 bg-white/[0.02] ${s.color==='purple'?'border-purple-500/20':s.color==='emerald'?'border-emerald-500/20':'border-amber-500/20'}`}>
            <p className="text-xs text-white/40">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color==='purple'?'text-purple-400':s.color==='emerald'?'text-emerald-400':'text-amber-400'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* الكارت الواحد — قيّم الدار */}
      <div className="bg-white/[0.02] border border-amber-500/20 rounded-[2.5rem] p-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-amber-400">👑 قيّم الدار — كارت واحد</span>
          <span className="text-[10px] text-white/30 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">8 وكلاء بدستور واحد — الأدوار كما هي</span>
          {unread > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">● {unread} جديد</span>}
        </div>
        <p className="text-[11px] text-white/40 mb-6">تتعامل مع القائد فقط — الـ 7 في الخلفية يشتغلون خفياً عبر Facade + MasterOrchestrator. للتواصل الفردي مع متخصص، افتح الاستوديو. {unread > 0 ? `لديك ${unread} رسالة غير مقروءة من قيّم` : ''}</p>

        <div className="max-w-2xl mx-auto">
          <div className="border rounded-[2rem] p-6 border-amber-500/30 bg-amber-500/[0.03] shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-700/10 border border-amber-500/20">👑</span>
                <div>
                  <h3 className="font-black text-lg text-white">قيّم الدار — القائد</h3>
                  <p className="text-xs text-white/50">قائد السرب: تنسيق، تدقيق شامل، نشر/تراجع، بوابة جودة</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span className="text-[11px] text-white/70 font-mono">{statusText}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <p className="text-lg font-black text-white">{qayyimStats.drafts}</p>
                <p className="text-[10px] text-white/40">مسودة معلقة</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <p className="text-lg font-black text-amber-300">{qayyimStats.luxuryScore ?? '—'}</p>
                <p className="text-[10px] text-white/40">Luxury Score</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
                <p className="text-[10px] font-bold text-white/60 truncate">{qayyimStats.lastAudit ? new Date(qayyimStats.lastAudit).toLocaleDateString('ar-EG') : '—'}</p>
                <p className="text-[10px] text-white/40">آخر تدقيق</p>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px] mb-5">
              <div className="flex items-center gap-1.5 flex-wrap"><span className="text-white/40 font-bold">المعطيات:</span>{['room_sections','products','qayyim_drafts','visitor_telemetry'].map(inp=><span key={inp} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 font-mono">{inp}</span>)}</div>
              <div className="flex items-center gap-1.5 flex-wrap"><span className="text-white/40 font-bold">المخرجات:</span>{['تقرير تدقيق شامل','مسودات منسقة','نشر/تراجع بموافقة'].map(out=><span key={out} className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">{out}</span>)}</div>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <span className="text-[11px] text-white/40 font-bold flex items-center gap-1">⚡ مهام بنقرة واحدة (عبر القائد):</span>
              <div className="space-y-1.5">
                {[
                  { label: 'افحص الموقع كله شاملاً', prompt: 'افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً' },
                  { label: 'نسّق السرب للرئيسية', prompt: 'نسّق السرب لتحسين الصفحة الرئيسية كاملاً' },
                  { label: 'اعرض المسودات المعلقة', prompt: 'اعرض المسودات المعلقة للمراجعة والنشر' },
                ].map(m=>(
                  <button key={m.label} onClick={()=>{setChatInitialMission(m.prompt); setActiveChatAgent('qayyim-core');}} className="w-full text-right px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white flex items-center justify-between">
                    <span>{m.label}</span><span className="text-[10px] text-white/30">تشغيل ➔</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={()=>{setChatInitialMission(undefined); setActiveChatAgent('qayyim-core');}} className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs text-white font-bold flex items-center justify-center gap-1.5">💬 تحدث مع القائد</button>
                <Link href="/admin/v2/qayyim" className="py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 text-center">✨ فتح الاستوديو الكامل</Link>
              </div>
              <p className="text-[10px] text-white/30 text-center mt-2">داخل الاستوديو: 6 Tabs + 8 وكلاء للتواصل الفردي عبر الشريط الجانبي — الـ 7 لا يظهرون هنا</p>
            </div>
          </div>
        </div>
      </div>

      {/* مساحة فاضية لنقل القديم */}
      <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.01] p-8 text-center">
        <p className="text-sm text-white/30">مساحة محجوزة — هنا ستنقل باقي مركز القيادة من القديم (مركز العمل، المبيعات...) واحدة واحدة</p>
        <p className="text-xs text-white/20 mt-1 font-mono">v2/agents — كارت واحد فقط لقيّم — لا زحمة</p>
      </div>

      {/* شات القائد */}
      {activeChatAgent && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={()=>setActiveChatAgent(null)}>
          <div className="w-full max-w-2xl bg-[#111] border border-white/20 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <ChatPanel agentKey={activeChatAgent} agentName="قيّم الدار — القائد" initialMessage={chatInitialMission} />
          </div>
        </div>
      )}
      {showGroupChat && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={()=>setShowGroupChat(false)}>
          <div className="w-full max-w-4xl bg-[#111] border border-[#C5A059]/30 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <GroupChatView onClose={()=>setShowGroupChat(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
