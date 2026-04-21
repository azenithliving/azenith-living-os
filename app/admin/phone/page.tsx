"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Globe, MessageSquare, Camera, Play, Grid, Search, Menu } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  // استخدام محرك المتصفح المستقر (N.eko) بملء الشاشة داخل واجهة الموبايل
  const nekoUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?q=android+apps+online&igu=1";

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
    <div className="fixed inset-0 bg-[#020202] flex items-center justify-center overflow-hidden font-sans">
      
      {/* Sovereign Mobile Chassis */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Dynamic Status Bar */}
        <div className="h-10 bg-black/90 backdrop-blur-md flex items-center justify-between px-8 z-[100]">
          <div className="text-[13px] font-bold text-white tracking-tight">{time}</div>
          
          <div className="w-24 h-6 bg-[#111] rounded-full border border-white/10 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Sovereign Node</span>
          </div>

          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-white/80" />
            <Wifi className="w-4 h-4 text-white/80" />
            <Battery className="w-5 h-5 text-white/80" />
          </div>
        </div>

        {/* The Core Experience (Stable N.eko Engine) */}
        <div className="flex-1 relative bg-black">
          <iframe 
            src={nekoUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Mobile Engine"
          />
        </div>

        {/* Interactive Bottom Navigation Dock */}
        <div className="h-24 bg-black/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-center relative">
          <div className="flex items-center justify-between w-full max-w-sm px-6">
             <div className="p-3 text-white/40 hover:text-white transition-colors cursor-pointer"><Menu className="w-6 h-6" /></div>
             <div className="p-4 bg-white rounded-full text-black shadow-[0_0_25px_rgba(255,255,255,0.2)] active:scale-90 transition-all cursor-pointer">
                <Home className="w-7 h-7" />
             </div>
             <div className="p-3 text-white/40 hover:text-white transition-colors cursor-pointer"><Search className="w-6 h-6" /></div>
          </div>
          <div className="absolute bottom-2 w-32 h-1.5 bg-white/10 rounded-full" />
        </div>

      </div>

      {/* Decorative Glows */}
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
    </div>
  );
}
