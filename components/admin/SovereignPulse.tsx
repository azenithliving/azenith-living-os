"use client";

import { useEffect, useState, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  Zap, 
  Brain, 
  Shield, 
  Settings, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ChevronLeft
} from 'lucide-react';

const supabase = createSupabaseBrowserClient();

interface Event {
  id: string;
  entity_type: string;
  event_category: string;
  event_name: string;
  description: string;
  payload: any;
  impact_score: number;
  criticality: string;
  created_at: string;
}

const CATEGORY_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  cognition: { icon: Brain, color: "text-amber-400", bg: "border-amber-500/30" },
  execution: { icon: Zap, color: "text-blue-400", bg: "border-blue-500/30" },
  security: { icon: Shield, color: "text-emerald-400", bg: "border-emerald-500/30" },
  evolution: { icon: Settings, color: "text-purple-400", bg: "border-purple-500/30" },
};

const DEFAULT_STYLE = { icon: Activity, color: "text-white/60", bg: "border-white/10" };

export function SovereignPulse() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('sovereign_event_horizon')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (data && !error) setEvents(data);
      } catch (err) {
        console.error('Failed to fetch sovereign events:', err);
      }
    };

    fetchEvents();

    const channel = supabase
      .channel('sovereign-pulse-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sovereign_event_horizon' }, (payload) => {
        setEvents(prev => [payload.new as Event, ...prev].slice(0, 30));
        setIsConnected(true);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/10 bg-[#0a0a0c] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className={`h-5 w-5 ${isConnected ? 'text-amber-500' : 'text-white/20'}`} />
            {isConnected && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">سجل أحداث النظام اللحظي (Event Stream)</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">PostgreSQL Event Horizon • Real-time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] text-white/30 px-2 py-1 rounded-full border border-white/10">
             {events.length} نشاط مسجل
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5">
        {events.map((event, idx) => {
          const style = CATEGORY_STYLES[event.event_category] || DEFAULT_STYLE;
          const Icon = style.icon;
          const rawScore = typeof event.impact_score === 'number' ? event.impact_score : 0;
          const normalizedScore = Math.min(Math.max(rawScore > 1 ? rawScore / 100 : rawScore, -1), 1);
          const displayPercentage = Math.round(normalizedScore * 100);
          
          return (
            <div 
              key={event.id} 
              className={`group relative flex gap-4 p-3 rounded-xl border ${style.bg} bg-white/[0.01] transition-all hover:bg-white/[0.03] animate-in fade-in slide-in-from-right-4 duration-500`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={`flex-shrink-0 h-10 w-10 rounded-lg bg-black flex items-center justify-center border border-white/5 shadow-2xl`}>
                <Icon className={`h-5 w-5 ${style.color}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${style.color}`}>
                      {event.event_category}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-white/20"></span>
                    <span className="text-xs font-bold text-white/90 truncate">
                      {event.event_name}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/20 tabular-nums">
                    {new Date(event.created_at).toLocaleTimeString('ar-SA')}
                  </span>
                </div>
                
                <p className="text-sm text-white/60 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                  {event.description}
                </p>

                {displayPercentage !== 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${displayPercentage > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                        style={{ width: `${Math.min(Math.abs(displayPercentage), 100)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-bold ${displayPercentage > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {displayPercentage > 0 ? '+' : ''}{displayPercentage}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
            <Activity className="h-12 w-12 mb-4 animate-pulse text-white/30" />
            <p className="text-sm text-white/50">لا توجد أحداث مسجلة في جدول الأحداث حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
