"use client";

import React, { useState, useEffect } from 'react';

const NEKO_URL = process.env.NEXT_PUBLIC_NEKO_URL || ""; 

export default function SovereignOS() {
  const [isConnected, setIsConnected] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (NEKO_URL) setIsConnected(true);
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
            boxShadow: 'inset 0 0 20px rgba(0,0,0,1)',
          }}>
            
            {/* TOP BAR - FIXED HEIGHT (32px) */}
            <div className="absolute top-0 left-0 right-0 h-8 z-30 flex items-center justify-between px-4 bg-[#141419] border-b border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[8px] font-black tracking-[0.4em] text-white/20 uppercase">Sovereign Browser</span>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            </div>

            {/* IFRAME CONTAINER - Fills remaining space */}
            <div className="absolute inset-0 pt-8">
              {isConnected ? (
                <iframe 
                  src={NEKO_URL}
                  className="w-full h-full border-0 bg-white"
                  allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                  style={{ width: '100%', height: '100%', display: 'block' }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#050507]">
                   <div className="text-[10px] uppercase tracking-[0.3em] text-[#C5A059] opacity-30">System Idle</div>
                </div>
              )}
            </div>

            {/* VIGNETTE & REFLECTION */}
            <div className="absolute inset-0 pointer-events-none z-40 bg-gradient-to-br from-white/[0.02] to-transparent" />
            <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]" />
          </div>

          {/* BOTTOM BEZEL LOGO */}
          <div className="absolute bottom-0 left-0 right-0 h-11 flex items-center justify-center">
             <span className="text-[9px] font-black tracking-[0.8em] text-white/10 uppercase">AZENITH</span>
          </div>
        </div>

        {/* STAND NECK */}
        <div className="mx-auto w-28 h-14 bg-[#16161a]" style={{ 
          clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
          background: 'linear-gradient(to bottom, #1a1a1e, #0a0a0c)'
        }} />
        
        {/* STAND BASE */}
        <div className="mx-auto w-72 h-4 rounded-full bg-gradient-to-b from-[#2a2a2e] to-[#050507] shadow-2xl" />
      </div>

    </div>
  );
}
