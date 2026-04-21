"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Globe, MessageSquare, Camera, Play, Grid } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  // نستخدم نفس الرابط اللي شغال في الكمبيوتر (لأنه مضمون 100%)
  const nekoUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1";

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

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden font-sans">
      
      {/* Sovereign Mobile OS - Guaranteed Working Version */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden border-x border-white/5">
        
        {/* Modern Status Bar */}
        <div className="h-10 bg-black z-[200] flex items-center justify-between px-8">
          <div className="text-[13px] font-bold text-white tracking-tight">{time}</div>
          
          <div className="w-24 h-6 bg-black rounded-full border border-white/10 flex items-center justify-center">
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Sovereign Bridge</span>
          </div>

          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-white" />
            <Wifi className="w-4 h-4 text-white" />
            <Battery className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* The Working Core (Same as Computer for 100% Reliability) */}
        <div className="flex-1 relative bg-[#0a0a0a]">
          <iframe 
            src={nekoUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Phone Core"
          />
        </div>

        {/* Mobile Navigation Dock */}
        <div className="h-20 bg-black/90 backdrop-blur-3xl border-t border-white/5 flex items-center justify-around px-10 pb-2">
          <div className="p-3 text-white/40"><MessageSquare className="w-6 h-6" /></div>
          <div className="p-4 bg-white rounded-full text-black shadow-lg shadow-white/10"><Home className="w-6 h-6" /></div>
          <div className="p-3 text-white/40"><Globe className="w-6 h-6" /></div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />

      </div>
    </div>
  );
}
