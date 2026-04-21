"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, Power } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام الـ Proxy بتاعنا لفتح محاكي أندرويد حقيقي (Redroid / Android Online)
  const proxyUrl = "/api/android-proxy?url=";
  const androidEmulator = "https://www.apkonline.net/apkonline/android-online-emulator.html?emulator=android-11-r";
  const finalUrl = `${proxyUrl}${encodeURIComponent(androidEmulator)}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      
      {/* Sovereign Android 11 Engine */}
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Modern Mobile Status Bar */}
        <div className="h-10 bg-black/90 backdrop-blur-md flex items-center justify-between px-6 z-[100]">
          <div className="text-[13px] font-bold text-white tracking-tight">SOVEREIGN DROID</div>
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4 text-white" />
            <Wifi className="w-4 h-4 text-white" />
            <Battery className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Real Android 11 Core (Proxied) */}
        <div className="flex-1 relative bg-black">
          <iframe 
            src={finalUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; clipboard-read; clipboard-write"
            title="Sovereign Android 11 Node"
          />
        </div>

        {/* Navigation Controls */}
        <div className="h-16 bg-black flex items-center justify-around px-8">
          <ChevronLeft className="w-6 h-6 text-white/40" />
          <div className="w-12 h-12 bg-white/10 rounded-full border border-white/10 flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-sm" />
          </div>
          <Grid className="w-6 h-6 text-white/40" />
        </div>
        
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Power Button Overlay (Instruction) */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-white/10 rounded-l-md border border-white/5" />
    </div>
  );
}
