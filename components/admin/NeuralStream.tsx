"use client";

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { Activity, Brain, ShieldCheck, BarChart3, Palette } from 'lucide-react';

const supabase = createSupabaseBrowserClient();

// Map agent names to icons and colors for visual distinction
const agentStyles: Record<string, { icon: any; color: string; bg: string }> = {
  "الوكيل التنفيذي (القائد)": { icon: Brain, color: "text-[#C5A059]", bg: "border-[#C5A059]/30" },
  "وكيل تجربة المستخدم (UI/UX)": { icon: Palette, color: "text-purple-400", bg: "border-purple-500/30" },
  "وكيل البيانات والتسويق": { icon: BarChart3, color: "text-blue-400", bg: "border-blue-500/30" },
  "الوكيل الأمني": { icon: ShieldCheck, color: "text-emerald-400", bg: "border-emerald-500/30" },
  "الوكيل التنفيذي": { icon: Brain, color: "text-[#C5A059]", bg: "border-[#C5A059]/30" },
};

const defaultStyle = { icon: Activity, color: "text-white/60", bg: "border-white/10" };

export function NeuralStream() {
  const [thoughts, setThoughts] = useState<any[]>([]);

  useEffect(() => {
    const fetchThoughts = async () => {
      const { data } = await supabase
        .from('neural_stream')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);
      if (data) setThoughts(data);
    };

    fetchThoughts();

    // Real-time: new thoughts appear instantly
    const channel = supabase
      .channel('neural-stream-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'neural_stream' }, (payload) => {
        setThoughts(prev => [payload.new, ...prev].slice(0, 15));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-4 rounded-xl border border-[#C5A059]/20 bg-black/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Activity className="h-5 w-5 text-[#C5A059] animate-pulse" />
            تيار الوعي الرقمي
          </h3>
          <p className="text-xs text-white/50">ما يدور في عقل النظام الآن — كل وكيل يظهر بلونه الخاص</p>
        </div>
      </div>

      <div className="h-[400px] space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#C5A059]/20">
        {thoughts.map((thought) => {
          const style = agentStyles[thought.agent_name] || defaultStyle;
          const IconComponent = style.icon;
          return (
            <div key={thought.id} className={`group relative rounded-lg border ${style.bg} bg-white/[0.02] p-3 transition-all hover:bg-white/[0.05]`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`flex items-center gap-1.5 text-[11px] font-bold ${style.color}`}>
                  <IconComponent className="h-3.5 w-3.5" />
                  {thought.agent_name}
                </span>
                <span className="text-[10px] text-white/30">{new Date(thought.created_at).toLocaleTimeString('ar-SA')}</span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed">
                {thought.thought_process}
              </p>
              <div 
                className={`absolute bottom-0 right-0 h-[2px] ${style.color.replace('text-', 'bg-')}/40 transition-all group-hover:${style.color.replace('text-', 'bg-')}`} 
                style={{ width: `${(thought.intensity || 0.5) * 100}%` }} 
              />
            </div>
          );
        })}
        {thoughts.length === 0 && (
          <p className="text-center text-white/30 py-20">في انتظار أول إشارة عصبية...</p>
        )}
      </div>
    </div>
  );
}
