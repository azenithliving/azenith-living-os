"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام محاكي أندرويد مفتوح المصدر (JS-Based) يعمل داخل المتصفح مباشرة ولا يحتاج لسيرفرات معقدة
  const androidUrl = "https://www.online-emulator.com/android.php";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Sovereign Fullscreen Android/Mobile Interface */}
      <iframe 
        src={androidUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: '100vw', height: '100vh', backgroundColor: '#fff' }}
        title="Sovereign Android Online"
      />

      {/* Floating Mode Indicator */}
      <div className="absolute top-4 left-4 pointer-events-none opacity-40">
        <span className="text-[9px] font-black tracking-[0.4em] text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Mobile Node (Web-Stream)
        </span>
      </div>
    </div>
  );
}
