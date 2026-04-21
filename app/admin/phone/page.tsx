"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Search, Layers, ChevronLeft } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState("https://www.google.com/search?q=android+apps+online&igu=1");
  const [time, setTime] = useState("");

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
    <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
      {/* Sovereign Mobile OS - Edge to Edge Experience */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* iOS-Style Status Bar */}
        <div className="h-10 bg-black/80 backdrop-blur-md flex items-center justify-between px-6 z-[100] border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-white tracking-tight">{time}</span>
          </div>
          
          <div className="absolute left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-b-2xl border-x border-b border-white/10" />

          <div className="flex items-center gap-2 opacity-90">
            <Signal className="w-4 h-4 text-white" />
            <Wifi className="w-4 h-4 text-white" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-white">85%</span>
              <Battery className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* The Core Mobile Interface (Sovereign Web Node) */}
        <div className="flex-1 relative bg-[#1a1a1a]">
          <iframe 
            src={url}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Mobile Node"
          />
        </div>

        {/* iOS-Style Bottom Navigation Bar */}
        <div className="h-20 bg-black/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4 pb-4">
          <button onClick={() => window.history.back()} className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-white/50" />
          </button>
          <button onClick={() => setUrl("https://www.google.com/search?q=android+apps+online&igu=1")} className="p-4 bg-white/10 rounded-2xl border border-white/10 shadow-lg active:scale-95 transition-all">
            <Home className="w-6 h-6 text-white" />
          </button>
          <button className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <Search className="w-6 h-6 text-white/50" />
          </button>
          <button className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <Layers className="w-6 h-6 text-white/50" />
          </button>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full z-[101]" />
      </div>

      {/* Floating System Overlay */}
      <div className="absolute top-14 left-4 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[9px] font-black tracking-widest text-white/60 uppercase">Node Active</span>
        </div>
      </div>
    </div>
  );
}
