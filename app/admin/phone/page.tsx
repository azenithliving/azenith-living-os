"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام محاكي أندرويد مباشر ومجاني من خلال الـ Bridge السيادي
  const androidUrl = "https://www.online-emulator.com/android.php";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Sovereign Mobile Bridge - Powered by Sovereign Browser Engine */}
      <iframe 
        src={androidUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: '100vw', height: '100vh', backgroundColor: '#fff' }}
        title="Sovereign Android System"
      />

      {/* Floating System Status */}
      <div className="absolute top-4 left-4 pointer-events-none opacity-40">
        <span className="text-[9px] font-black tracking-[0.4em] text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Mobile v2.1 • Online
        </span>
      </div>
    </div>
  );
}
