"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // استخدام محاكي أندرويد حديث مع حيلة الـ No-Referrer لتخطي الحجب
  const androidUrl = "https://appetize.io/embed/demo?device=nexus5&osVersion=8.1&scale=75&autoplay=true";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Sovereign Fullscreen Modern Android Interface */}
      {/* استخدمنا referrerpolicy="no-referrer" لتخطي حماية المواقع ومنعها من معرفة مصدر الطلب */}
      <iframe 
        src={androidUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        referrerPolicy="no-referrer"
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        title="Sovereign Modern Droid"
      />

      {/* Floating System Status */}
      <div className="absolute top-4 left-4 pointer-events-none opacity-40">
        <span className="text-[9px] font-black tracking-[0.4em] text-white uppercase bg-black/50 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
          Sovereign Mobile v3.0 • Premium Node
        </span>
      </div>
    </div>
  );
}
