'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Brain } from 'lucide-react';

type AgentStatus = { agent: string; status: 'online' | 'busy' | 'offline'; taskCount: number; recentActivity: string };

/**
 * P5-M2 — the seed card: notifications-first, nothing else.
 * Stats/missions live inside the full-screen chat now.
 */
export default function V2AgentsPage() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [unread, setUnread] = useState(0);
  const [teaser, setTeaser] = useState<string | null>(null);

  // NOTE: /messages?unread=true marks messages read server-side — fetch ONCE
  // on mount so the badge survives until the admin actually opens the chat.
  const fetchOnce = useCallback(async () => {
    try {
      const [statusRes, msgRes] = await Promise.all([
        fetch('/api/admin/agents/chat'),
        fetch('/api/admin/agents/messages?agent_key=qayyim-core&unread=true'),
      ]);
      const statusData = await statusRes.json();
      if (statusData.success && statusData.data?.['qayyim-core']) setAgentStatus(statusData.data['qayyim-core']);
      const msgData = await msgRes.json();
      if (msgData.success) {
        setUnread(msgData.count || 0);
        const last = (msgData.data || []).filter((m: any) => m.sender_type === 'agent').slice(-1)[0];
        if (last) setTeaser(String(last.content || '').replace(/[#*`>]/g, '').slice(0, 120));
      }
    } catch {}
  }, []);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  // Live status dot only (never touches read state)
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/agents/chat');
        const data = await res.json();
        if (data.success && data.data?.['qayyim-core']) setAgentStatus(data.data['qayyim-core']);
      } catch {}
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const statusText = agentStatus?.status === 'online' ? 'متصل وجاهز' : agentStatus?.status === 'busy' ? 'قيد المعالجة' : 'نشط';
  const dotColor = agentStatus?.status === 'busy' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6" dir="rtl">
      <Link
        href="/admin/v2/agents/qayyim"
        className="group w-full max-w-md block rounded-[2rem] border border-amber-500/25 bg-white/[0.02] hover:bg-amber-500/[0.04] p-7 transition-all shadow-xl"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full" />
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-700/10 border border-amber-500/25 flex items-center justify-center">
              <Brain className="w-7 h-7 text-amber-400" />
            </div>
            <span className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${dotColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-white text-lg">مدير تشغيل المحتوى</h2>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">{unread} ●</span>
              )}
            </div>
            <p className="text-[11px] text-white/40">قيّم الدار · {statusText}{agentStatus?.taskCount ? ` · ${agentStatus.taskCount} مهمة` : ''}</p>
          </div>
          <span className="text-white/20 group-hover:text-amber-400 transition-colors text-xl">➜</span>
        </div>

        <div className="mt-5 rounded-2xl bg-black/30 border border-white/5 px-4 py-3">
          <p className="text-xs text-white/60 leading-relaxed line-clamp-2">
            {teaser ?? 'لا رسائل جديدة — افتح المحادثة لتكليف مدير تشغيل المحتوى.'}
          </p>
        </div>
      </Link>
    </div>
  );
}
