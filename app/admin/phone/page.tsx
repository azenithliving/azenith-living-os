"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, Power, RefreshCw } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  // استخدام البورت الرسمي للمحاكي الحديث (Web-VNC)
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

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#080808] flex items-center justify-center overflow-hidden font-sans">
      
      {/* Sovereign Android Engine - Research-Backed Solution */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Modern Status Bar */}
        <div className="h-10 bg-black/90 backdrop-blur-md flex items-center justify-between px-8 z-[100]">
          <div className="text-[13px] font-bold text-white tracking-tight">{time}</div>
          
          <div className="px-3 h-6 bg-blue-600/20 rounded-full border border-blue-500/30 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Sovereign v11.0</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Signal className="w-4 h-4 text-white/90" />
            <Wifi className="w-4 h-4 text-white/90" />
            <Battery className="w-5 h-5 text-white/90" />
          </div>
        </div>

        {/* The Real Android Core (Web-VNC Interface) */}
        <div className="flex-1 relative bg-black">
          <iframe 
            src={androidUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Android System"
          />
          
          {/* Instructions Overlay if needed */}
          <div className="absolute top-4 right-4 pointer-events-none opacity-20">
             <RefreshCw className="w-4 h-4 text-white animate-spin-slow" />
          </div>
        </div>

        {/* Smartphone Navigation Bar */}
        <div className="h-20 bg-black/95 border-t border-white/5 flex items-center justify-around px-12 pb-2">
          <button className="p-3 hover:bg-white/5 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-white/40" />
          </button>
          <button className="p-4 bg-white rounded-full text-black shadow-lg shadow-white/10 active:scale-90 transition-all">
            <Home className="w-7 h-7" />
          </button>
          <button className="p-3 hover:bg-white/5 rounded-full transition-colors">
            <Grid className="w-6 h-6 text-white/40" />
          </button>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}
