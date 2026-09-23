'use client';

/**
 * /admin/qayyim — استوديو سرب قيّم الدار
 *
 * الصفحة الرئيسية لمنظومة القيّم: تعرض QayyimStudio كاملاً مع
 * header تنقل وزر رجوع لمركز الوكلاء.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Crown, ArrowRight, MessageSquare, Zap, RefreshCw,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { QayyimStudio } from '@/components/admin/qayyim/QayyimStudio';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';

// ── الوكلاء الثمانية للتبديل السريع ──────────────────────────────────
const SWARM_QUICK: Array<{
  key: string; label: string; icon: string; color: string;
}> = [
  { key: 'qayyim-core', label: 'القائد',    icon: '👑', color: 'amber' },
  { key: 'qayyim-cont', label: 'المحتوى',   icon: '✍️', color: 'rose' },
  { key: 'qayyim-vis',  label: 'المرئيات',  icon: '🖼️', color: 'violet' },
  { key: 'qayyim-seo',  label: 'الظهور',    icon: '🔍', color: 'sky' },
  { key: 'qayyim-ux',   label: 'التجربة',   icon: '🎯', color: 'emerald' },
  { key: 'qayyim-ana',  label: 'التحليلات', icon: '📈', color: 'cyan' },
  { key: 'qayyim-dev',  label: 'التطوير',   icon: '⚡', color: 'orange' },
  { key: 'qayyim-qa',   label: 'الجودة',    icon: '🧪', color: 'lime' },
];

const AGENT_NAMES: Record<string, string> = {
  'qayyim-core': 'قيّم الدار — القائد',
  'qayyim-cont': 'قيّم الدار — المحتوى',
  'qayyim-vis':  'قيّم الدار — المرئيات',
  'qayyim-seo':  'قيّم الدار — الظهور',
  'qayyim-ux':   'قيّم الدار — التجربة',
  'qayyim-ana':  'قيّم الدار — التحليلات',
  'qayyim-dev':  'قيّم الدار — التطوير',
  'qayyim-qa':   'قيّم الدار — الجودة',
};

// quick-launch missions for qayyim-core
const QUICK_MISSIONS = [
  'افحص الموقع كله شاملاً وأعطني تقريراً تنفيذياً',
  'نسّق السرب لتحسين الصفحة الرئيسية كاملاً',
  'اعرض المسودات المعلقة للمراجعة والنشر',
  'شغّل بوابة الجودة على آخر مسودة',
];

export default function QayyimPage() {
  const [activeChatAgent, setActiveChatAgent] = useState<string | null>(null);
  const [chatMission, setChatMission]         = useState<string | undefined>(undefined);
  const [showQuickChat, setShowQuickChat]     = useState(false);
  const [quickChatKey, setQuickChatKey]       = useState('qayyim-core');

  function openChat(key: string, mission?: string) {
    setChatMission(mission);
    setActiveChatAgent(key);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      {/* ══════════════════════════════════════════════════
          الشريط العلوي
      ══════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* اليسار: شعار + breadcrumb */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/agents"
              className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              مركز الوكلاء
            </Link>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
                <Crown className="w-4 h-4 text-amber-300" />
              </div>
              <span className="font-black text-sm text-white">استوديو قيّم الدار</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-mono">
                8 وكلاء · نشط
              </span>
            </div>
          </div>

          {/* اليمين: أزرار سريعة */}
          <div className="flex items-center gap-2">
            {/* Quick-launch: chat مع وكيل محدد */}
            <div className="relative">
              <button
                onClick={() => setShowQuickChat(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                محادثة وكيل
                {showQuickChat
                  ? <ChevronUp className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />}
              </button>
              {showQuickChat && (
                <div className="absolute left-0 top-full mt-1.5 w-56 bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-2 z-50">
                  {SWARM_QUICK.map(a => (
                    <button
                      key={a.key}
                      onClick={() => { openChat(a.key); setShowQuickChat(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs hover:bg-white/5 text-white/70 hover:text-white transition-colors text-right"
                    >
                      <span>{a.icon}</span>
                      <span className="font-medium">{a.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* مهمة فورية لقيّم الدار القائد */}
            <button
              onClick={() => openChat('qayyim-core', QUICK_MISSIONS[0])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-xs text-amber-300 font-semibold hover:bg-amber-500/25 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              افحص الموقع الآن
            </button>

            <Link
              href="/admin/agents"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              مركز الوكلاء
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════
          مهام سريعة — شريط تحت الهيدر
      ══════════════════════════════════════════════════ */}
      <div className="border-b border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-white/30 whitespace-nowrap font-bold flex items-center gap-1 ml-2">
            <Sparkles className="w-3 h-3" /> مهام فورية للقائد:
          </span>
          {QUICK_MISSIONS.map((mission, i) => (
            <button
              key={i}
              onClick={() => openChat('qayyim-core', mission)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-[11px] text-white/60 hover:text-white whitespace-nowrap transition-all"
            >
              <span className="text-amber-400">⚡</span>
              {mission.length > 40 ? mission.slice(0, 40) + '…' : mission}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          الوكلاء الثمانية — شريط وصول سريع
      ══════════════════════════════════════════════════ */}
      <div className="border-b border-white/[0.04]">
        <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {SWARM_QUICK.map(a => (
            <button
              key={a.key}
              onClick={() => openChat(a.key)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-[11px] text-white/50 hover:text-white whitespace-nowrap transition-all"
            >
              <span className="text-sm">{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          المحتوى الرئيسي — QayyimStudio
      ══════════════════════════════════════════════════ */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <QayyimStudio />
      </main>

      {/* ══════════════════════════════════════════════════
          Modal: محادثة مع وكيل محدد
      ══════════════════════════════════════════════════ */}
      {activeChatAgent && (
        <div
          className="fixed inset-0 bg-black/90 z-[100] backdrop-blur-xl flex items-center justify-center p-6"
          onClick={() => { setActiveChatAgent(null); setChatMission(undefined); }}
        >
          <div
            className="w-full max-w-2xl bg-[#0f0f0f] border border-white/15 rounded-[2.5rem] overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <ChatPanel
              agentKey={activeChatAgent}
              agentName={AGENT_NAMES[activeChatAgent]}
              agentColor={SWARM_QUICK.find(a => a.key === activeChatAgent)?.color || 'amber'}
              initialMessage={chatMission}
            />
          </div>
        </div>
      )}
    </div>
  );
}
