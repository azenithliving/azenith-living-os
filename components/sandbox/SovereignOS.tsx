"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

interface SovereignOSProps {
  onToggleDevice?: () => void;
}

export default function SovereignOS({ onToggleDevice }: SovereignOSProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (process.env.NEXT_PUBLIC_NEKO_URL) setIsConnected(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-[1000px] mx-auto select-none p-4">
      
      {/* ── MONITOR FRAME ── */}
      <div className="relative w-full group" style={{ filter: 'drop-shadow(0 40px 100px rgba(0,0,0,0.9))' }}>
        
        {/* OUTER BEZEL */}
        <div className="relative w-full rounded-[28px] p-[12px] pb-[44px]" style={{
          background: 'linear-gradient(165deg, #2c2c30 0%, #1a1a1e 40%, #0f0f12 100%)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 0 0 1px rgba(0,0,0,1)',
        }}>
          
          {/* SCREEN AREA */}
          <div className="relative w-full overflow-hidden bg-black" style={{
            aspectRatio: '16/10',
            borderRadius: '12px',
          }}>
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 z-30 flex items-center justify-between px-4 bg-[#141419] border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[8px] font-black tracking-[0.4em] text-white/20 uppercase">Sovereign Browser</span>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            {/* Content (Iframe) */}
            <div className="absolute inset-0 pt-8">
              <iframe 
                src={process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1"}
                className="w-full h-full border-0 bg-white"
                allow="autoplay; fullscreen"
              />
            </div>
          </div>

          {/* BOTTOM BEZEL CONTROLS */}
          <div className="absolute bottom-0 left-0 right-0 h-11 flex items-center justify-between px-8">
             {/* TOGGLE BUTTON (SHAPED LIKE PHONE) */}
             <button 
                onClick={onToggleDevice}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#C5A059]/50 transition-all group"
                title="Switch to Sovereign Mobile"
             >
                <Smartphone size={16} className="text-white/40 group-hover:text-[#C5A059] transition-colors" />
             </button>

             <span className="text-[9px] font-black tracking-[0.8em] text-white/5 uppercase">AZENITH</span>
             
             <div className="w-8" /> {/* Placeholder for symmetry */}
          </div>
        </div>

        {/* STAND */}
        <div className="mx-auto w-28 h-12 bg-[#16161a]" style={{ clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)' }} />
        <div className="mx-auto w-72 h-3 rounded-full bg-gradient-to-b from-[#2a2a2e] to-[#050507]" />
      </div>

    </div>
  );
}
