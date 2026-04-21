"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام محاكي أندرويد "حر" (Open Source Emulator) مسموح بدمجه في أي موقع
  const androidUrl = "https://copy.sh/v86/?profile=android";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Sovereign Fullscreen Open-Source Android Emulator */}
      <iframe 
        src={androidUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        title="Sovereign Open Mobile"
      />

      {/* Floating System Status */}
      <div className="absolute top-4 left-4 pointer-events-none opacity-40">
        <span className="text-[9px] font-black tracking-[0.4em] text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Open Droid • Active
        </span>
      </div>
    </div>
  );
}
