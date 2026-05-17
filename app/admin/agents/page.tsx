'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeviceCard } from '@/components/admin/agents/DeviceCard';
import { TaskQueue } from '@/components/admin/agents/TaskQueue';
import { CommandConsole } from '@/components/admin/agents/CommandConsole';
import { ApprovalGate } from '@/components/admin/agents/ApprovalGate';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { GroupChatView } from '@/components/admin/agents/GroupChatView';

import Link from 'next/link';
import { Brain, Cpu, MessageSquare, ShieldAlert, Activity, LayoutGrid, Terminal, Sparkles } from 'lucide-react';

export default function AgentsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [showPrimeChat, setShowPrimeChat] = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);

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
  
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto bg-[#0A0A0A] min-h-screen text-white">
      <Link
        href="/admin/assistant"
        className="block rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/10 p-4 hover:bg-[#C5A059]/15 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-[#C5A059]" />
          <div>
            <p className="font-bold text-[#C5A059]">المساعد الموحّد</p>
            <p className="text-xs text-white/50">تكلم عادي هنا — PRIME و Vanguard والوكلاء السبعة يشتغلوا من مكان واحد</p>
          </div>
        </div>
      </Link>

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
            <h1 className="text-3xl font-black tracking-tight">مركز قيادة الوكلاء</h1>
            <p className="text-white/40 mt-1 flex items-center gap-2">
              <Activity className="w-3 h-3 text-emerald-500" />
              إدارة الكيانات المستقلة: PRIME & Vanguard
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
      </div>
    </div>
  );
}
