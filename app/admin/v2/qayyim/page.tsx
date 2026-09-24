'use client';

import { QayyimStudio } from '@/components/admin/qayyim/QayyimStudio';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import Link from 'next/link';
import { Crown, ArrowRight, MessageSquare, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const SWARM_QUICK = [
  { key: 'qayyim-core', label: 'القائد', icon: '👑', color: 'amber' },
  { key: 'qayyim-cont', label: 'المحتوى', icon: '✍️', color: 'rose' },
  { key: 'qayyim-vis', label: 'المرئيات', icon: '🖼️', color: 'violet' },
  { key: 'qayyim-seo', label: 'الظهور', icon: '🔍', color: 'sky' },
  { key: 'qayyim-ux', label: 'التجربة', icon: '🎯', color: 'emerald' },
  { key: 'qayyim-ana', label: 'التحليلات', icon: '📈', color: 'cyan' },
  { key: 'qayyim-dev', label: 'التطوير', icon: '⚡', color: 'orange' },
  { key: 'qayyim-qa', label: 'الجودة', icon: '🧪', color: 'lime' },
];
const AGENT_NAMES: Record<string,string> = {
  'qayyim-core':'قيّم الدار — القائد','qayyim-cont':'قيّم الدار — المحتوى','qayyim-vis':'قيّم الدار — المرئيات','qayyim-seo':'قيّم الدار — الظهور','qayyim-ux':'قيّم الدار — التجربة','qayyim-ana':'قيّم الدار — التحليلات','qayyim-dev':'قيّم الدار — التطوير','qayyim-qa':'قيّم الدار — الجودة',
};
const QUICK_MISSIONS = ['افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً','نسّق السرب لتحسين الصفحة الرئيسية كاملاً','اعرض المسودات المعلقة للمراجعة والنشر','شغّل بوابة الجودة على آخر مسودة'];

export default function V2QayyimPage(){
  const [activeChatAgent,setActiveChatAgent]=useState<string|null>(null);
  const [chatMission,setChatMission]=useState<string|undefined>(undefined);
  const [showQuickChat,setShowQuickChat]=useState(false);
  function openChat(key:string, mission?:string){ setChatMission(mission); setActiveChatAgent(key); }
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/v2/agents" className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70"><ArrowRight className="w-3.5 h-3.5" /> مركز قيادة الوكلاء</Link>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-300" /></div>
              <span className="font-black text-sm text-white">قيّم الدار — الاستوديو</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-mono">8 وكلاء بدستور واحد</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={()=>setShowQuickChat(v=>!v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/[0.08]"><MessageSquare className="w-3.5 h-3.5" /> محادثة وكيل {showQuickChat?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}</button>
              {showQuickChat && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                  {SWARM_QUICK.map(a=>(
                    <button key={a.key} onClick={()=>{openChat(a.key); setShowQuickChat(false);}} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-white/5 text-white/70 hover:text-white text-right"><span>{a.icon}</span><span className="font-medium">{a.label}</span></button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={()=>openChat('qayyim-core',QUICK_MISSIONS[0])} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-xs text-amber-300 font-semibold hover:bg-amber-500/25"><Zap className="w-3.5 h-3.5" /> افحص الموقع الآن</button>
          </div>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2">
          <span className="text-amber-300">👑</span>
          <span className="text-xs text-amber-200"><b>أدوار قيّم الـ 8 كما هي</b> — تتحدث مع القائد فقط، وهو يوزع على 7 خفياً. للتواصل الفردي مع متخصص، استخدم الشريط أعلاه (متاح فقط هنا).</span>
        </div>
        <QayyimStudio />
      </div>
      {activeChatAgent && (
        <div className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6" onClick={()=>{setActiveChatAgent(null); setChatMission(undefined);}}>
          <div className="w-full max-w-2xl bg-[#0f0f0f] border border-white/15 rounded-[2.5rem] overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}>
            <ChatPanel agentKey={activeChatAgent} agentName={AGENT_NAMES[activeChatAgent]} agentColor={SWARM_QUICK.find(a=>a.key===activeChatAgent)?.color||'amber'} initialMessage={chatMission} />
          </div>
        </div>
      )}
    </div>
  );
}
