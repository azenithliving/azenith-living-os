"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Globe, MessageSquare, Camera, Play, Grid } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  // نستخدم محاكي أندرويد ويب سريع ومستقر جداً
  const androidUrl = "https://www.apkonline.net/apkonline/android-online-emulator.html?emulator=android-6.0-marshmallow";

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
      
      {/* Premium Smartphone Chassis Simulation */}
      <div className="relative w-full h-full max-w-none bg-black flex flex-col shadow-2xl overflow-hidden border-x border-white/5">
        
        {/* Dynamic Island / Notch Area */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-black z-[200] flex items-center justify-between px-8">
          <div className="text-[14px] font-bold text-white tracking-tight">{time}</div>
          
          {/* The "Island" */}
          <div className="w-32 h-6 bg-black rounded-full border border-white/10 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Sovereign OS</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Signal className="w-4 h-4 text-white/90" />
            <Wifi className="w-4 h-4 text-white/90" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-3 border border-white/30 rounded-[3px] relative flex items-center px-0.5">
                <div className="bg-white w-3/4 h-1.5 rounded-[1px]" />
                <div className="absolute -right-1 w-0.5 h-1 bg-white/30 rounded-r-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Display Area (Android Core) */}
        <div className="flex-1 mt-8 relative bg-[#0a0a0a]">
          <iframe 
            src={androidUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Mobile Engine"
          />
          
          {/* Subtle Screen Glare Effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-30" />
        </div>

        {/* Floating App Dock (Bottom Navigation) */}
        <div className="h-24 bg-black/80 backdrop-blur-3xl border-t border-white/5 flex items-center justify-center px-8 relative">
          <div className="flex items-center justify-between w-full max-w-md bg-white/5 p-4 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="p-3 bg-green-500/20 rounded-2xl border border-green-500/30 text-green-400 cursor-pointer hover:scale-110 transition-transform">
              <Globe className="w-6 h-6" />
            </div>
            <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30 text-blue-400 cursor-pointer hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6" />
            </div>
            {/* Main Home Button */}
            <div className="p-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer active:scale-90 transition-all">
              <Grid className="w-7 h-7 text-black" />
            </div>
            <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-500/30 text-purple-400 cursor-pointer hover:scale-110 transition-transform">
              <Camera className="w-6 h-6" />
            </div>
            <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/30 text-red-400 cursor-pointer hover:scale-110 transition-transform">
              <Play className="w-6 h-6" />
            </div>
          </div>
          
          {/* Home Indicator Bar */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/20 rounded-full" />
        </div>

      </div>

      {/* Background Ambient Glow */}
      <div className="fixed -bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed -top-1/4 -left-1/4 w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
}
