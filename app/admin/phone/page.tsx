"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام رابط مباشر ومجاني تماماً لا يمنع الـ Embedding
  const androidUrl = "https://www.apkonline.net/apkonline/android-online-emulator.html?emulator=android-6.0-marshmallow";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-white overflow-hidden flex flex-col">
      {/* Top Status Bar (Fake) for Realism */}
      <div className="h-6 bg-black flex items-center justify-between px-6 text-[10px] text-white/80 font-medium z-50">
        <span>Sovereign Mobile</span>
        <div className="flex gap-2 items-center">
          <span>5G</span>
          <div className="w-4 h-2 border border-white/30 rounded-sm relative">
            <div className="absolute inset-0 bg-green-500 w-3/4" />
          </div>
        </div>
      </div>

      {/* The Emulator */}
      <div className="flex-1 relative">
        <iframe 
          src={androidUrl}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
          style={{ width: '100vw', height: 'calc(100vh - 24px)' }}
        />
      </div>

      {/* Floating Button to help with navigation */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full text-[10px] text-white/50 border border-white/10 pointer-events-none">
        Click and Drag with Mouse to Swipe
      </div>
    </div>
  );
}
