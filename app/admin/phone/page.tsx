"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, Power, RefreshCw, Zap } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  // البورت الرسمي للمحاكي الحديث (Web-VNC)
  const androidUrl = "http://localhost:6080"; 

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden font-sans">
      
      {/* Sovereign Mobile OS - Active Control Center */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Modern Status Bar */}
        <div className="h-10 bg-black/95 flex items-center justify-between px-8 z-[100]">
          <div className="text-[13px] font-bold text-white tracking-tight">{time}</div>
          
          <div className="px-3 h-6 bg-green-500/10 rounded-full border border-green-500/20 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">System Active</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Signal className="w-4 h-4 text-white/90" />
            <Wifi className="w-4 h-4 text-white/90" />
            <Battery className="w-5 h-5 text-white/90" />
          </div>
        </div>

        {/* The Core Experience (Web-VNC Core) */}
        <div className="flex-1 relative bg-black">
          <iframe 
            key={refreshKey}
            src={androidUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Android System"
          />
          
          {/* Quick Actions Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
             <button 
               onClick={handleRefresh}
               className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full backdrop-blur-md transition-all active:scale-95"
               title="Refresh Stream"
             >
               <RefreshCw className="w-4 h-4 text-white" />
             </button>
             <button 
               className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-full backdrop-blur-md transition-all active:scale-95"
               title="Boost Performance"
             >
               <Zap className="w-4 h-4 text-blue-400" />
             </button>
          </div>
        </div>

        {/* Premium Navigation Bar */}
        <div className="h-20 bg-black border-t border-white/5 flex items-center justify-around px-12 pb-2">
          <ChevronLeft className="w-6 h-6 text-white/30 cursor-pointer" />
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-90 transition-all cursor-pointer">
            <Home className="w-7 h-7 text-black" />
          </div>
          <Grid className="w-6 h-6 text-white/30 cursor-pointer" />
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Floating System Notification */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-2xl">
          <p className="text-[10px] text-white/70 font-medium tracking-wide">
             Ensure Cloud Shell port 6080 is previewed
          </p>
        </div>
      </div>
    </div>
  );
}
