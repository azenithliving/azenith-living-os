"use client";

import { useState, useEffect } from "react";

export default function ComputerPage() {
  const [mounted, setMounted] = useState(false);
  const browserUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Sovereign Fullscreen Browser */}
      <iframe 
        src={browserUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: '100vw', height: '100vh' }}
      />

      {/* Subtle Admin Indicator (Optional - Floating) */}
      <div className="absolute bottom-4 right-4 pointer-events-none opacity-20 group hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-black tracking-widest text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Node v2.0
        </span>
      </div>
    </div>
  );
}
