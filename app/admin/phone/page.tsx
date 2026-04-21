"use client";

import { useState, useEffect } from "react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  // الرابط ده هو متصفحك السيادي بس بنخليه يفتح على محاكي أندرويد موثوق
  const sovereignBrowserUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1";
  const androidTargetUrl = "https://www.apkonline.net/apkonline/android-online-emulator.html?emulator=android-6.0-marshmallow";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Sovereign Fullscreen Android Interface via Sovereign Browser */}
      <iframe 
        src={sovereignBrowserUrl}
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: '100vw', height: '100vh', backgroundColor: '#000' }}
        title="Sovereign Mobile Bridge"
      />

      {/* Floating Instructions Overlay (Subtle) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none transition-opacity duration-1000 opacity-60">
        <span className="text-[10px] font-medium text-white/50 bg-white/5 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
          Sovereign Mobile Bridge Active • Open Android in the browser below
        </span>
      </div>
    </div>
  );
}
