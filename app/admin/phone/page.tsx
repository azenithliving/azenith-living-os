"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, RefreshCw, Zap, ShieldCheck } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  // المحرك العالمي الحديث (Dockerify Android)
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
      
      {/* Sovereign Mobile OS - Powered by Dockerify 2026 */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Elite Status Bar */}
        <div className="h-10 bg-black/95 flex items-center justify-between px-8 z-[100] border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold text-white tracking-tight">{time}</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/20 rounded-full border border-blue-500/30">
               <ShieldCheck className="w-3 h-3 text-blue-400" />
               <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter">Sovereign Mode</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Signal className="w-4 h-4 text-white/80" />
            <Wifi className="w-4 h-4 text-white/80" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-white/60">100%</span>
              <Battery className="w-5 h-5 text-white/80" />
            </div>
          </div>
        </div>

        {/* The Live Stream (Dockerify Android Core) */}
        <div className="flex-1 relative bg-[#0a0a0a]">
          <iframe 
            key={refreshKey}
            src={androidUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Mobile Engine"
          />
          
          {/* Side Controls */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
             <button 
               onClick={handleRefresh}
               className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl backdrop-blur-xl transition-all active:scale-90 group"
             >
               <RefreshCw className="w-5 h-5 text-white/60 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
             </button>
             <button className="p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl backdrop-blur-xl transition-all active:scale-90">
               <Zap className="w-5 h-5 text-blue-400" />
             </button>
          </div>
        </div>

        {/* Premium Navigation Hub */}
        <div className="h-24 bg-black flex items-center justify-around px-12 pb-6 relative">
          <ChevronLeft className="w-7 h-7 text-white/20 cursor-pointer hover:text-white/40 transition-colors" />
          
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.15)] active:scale-90 transition-all cursor-pointer group">
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
               <Home className="w-5 h-5 text-white" />
            </div>
          </div>

          <Grid className="w-7 h-7 text-white/20 cursor-pointer hover:text-white/40 transition-colors" />
          
          {/* Home Indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full" />
        </div>

      </div>

      {/* Decorative Cinematic Background */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_120%,#1a1a1a,black)]" />
    </div>
  );
}
