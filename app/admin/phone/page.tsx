"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // نستخدم رابط n.eko أو الرابط الذي حددته في .env.local
  const androidUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Sovereign Fullscreen Android/Mobile Interface */}
      <iframe 
        src={androidUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write; camera; microphone"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Floating Mode Indicator */}
      <div className="absolute top-4 left-4 pointer-events-none opacity-20">
        <span className="text-[9px] font-black tracking-[0.4em] text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Mobile Node
        </span>
      </div>
    </div>
  );
}
