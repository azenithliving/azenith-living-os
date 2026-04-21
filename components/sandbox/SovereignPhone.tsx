"use client";

import React from 'react';

const NEKO_URL = process.env.NEXT_PUBLIC_NEKO_URL;
const isConnected = !!NEKO_URL;

export default function SovereignPhone() {
  return (
    <div
      className="relative select-none mx-auto"
      style={{
        height: 'min(90vh, 720px)',
        aspectRatio: '9/19.5',
        width: 'auto',
        filter: 'drop-shadow(0 60px 120px rgba(0,0,0,0.95)) drop-shadow(0 20px 50px rgba(0,0,0,0.7))',
      }}
    >
      {/* ── TITANIUM BODY ── */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '50px',
          background: 'linear-gradient(160deg, #4b4845 0%, #38352f 30%, #1e1c18 65%, #2c2a26 100%)',
          boxShadow: [
            '0 0 0 1px rgba(0,0,0,0.9)',
            'inset 0 1px 0 rgba(255,255,255,0.15)',
            'inset 1px 0 0 rgba(255,255,255,0.07)',
            'inset -1px 0 0 rgba(0,0,0,0.4)',
          ].join(', '),
        }}
      >
        <div className="absolute inset-0 opacity-30" style={{
          borderRadius: 'inherit',
          backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 1px, rgba(255,255,255,0.018) 1px, rgba(255,255,255,0.018) 2px)',
        }} />
      </div>

      {/* ── BUTTONS ── */}
      <div className="absolute" style={{ left: '-3px', top: '16%', width: '3px', height: '5%', borderRadius: '2px 0 0 2px', background: '#3e3c38' }} />
      <div className="absolute" style={{ left: '-3px', top: '23%', width: '3px', height: '9%', borderRadius: '2px 0 0 2px', background: '#3e3c38' }} />
      <div className="absolute" style={{ left: '-3px', top: '34%', width: '3px', height: '9%', borderRadius: '2px 0 0 2px', background: '#3e3c38' }} />
      <div className="absolute" style={{ right: '-3px', top: '22%', width: '3px', height: '13%', borderRadius: '0 2px 2px 0', background: '#3e3c38' }} />
      <div className="absolute" style={{ right: '-3px', top: '55%', width: '3px', height: '8%', borderRadius: '0 2px 2px 0', background: '#3e3c38' }} />

      {/* ── SCREEN ── */}
      <div
        className="absolute"
        style={{
          inset: '6px',
          borderRadius: '44px',
          background: '#000',
          boxShadow: '0 0 0 1px rgba(0,0,0,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── n.eko / BROWSER IFRAME ── */}
        <div className="absolute inset-0 w-full h-full z-10">
          {isConnected ? (
            <div className="relative w-full h-full overflow-hidden">
              <iframe
                src={NEKO_URL!}
                className="absolute border-0 bg-white"
                style={{ 
                  // نكبر الـ iframe لضعف الحجم وبعدين نصغره بالـ Scale
                  // ده بيجبر المواقع تظهر كأنها موبايل
                  width: '200%', 
                  height: '200%', 
                  top: 0,
                  left: 0,
                  transform: 'scale(0.5)', 
                  transformOrigin: 'top left',
                }}
                allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                title="Sovereign Browser Mobile"
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black">
              <div className="text-center opacity-10 space-y-2">
                <div className="text-2xl font-black tracking-tighter text-white">SOVEREIGN</div>
                <div className="text-[8px] tracking-[0.4em] text-[#C5A059]">STANDBY</div>
              </div>
            </div>
          )}
        </div>

        {/* ── DYNAMIC ISLAND (Cutout Overlay) ── */}
        <div className="absolute z-40 pointer-events-none" style={{
          top: '12px',
          left: '50%', transform: 'translateX(-50%)',
          width: '90px', height: '28px',
          borderRadius: '14px',
          background: '#000',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
        }}>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/5 border border-white/5" />
        </div>

        {/* Bottom Home Indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/20 rounded-full z-50 pointer-events-none" />

        {/* Screen Edge Shadow / Vignette */}
        <div className="absolute inset-0 pointer-events-none z-50 rounded-[44px] shadow-[inset_0_0_15px_rgba(0,0,0,0.4)]" />
      </div>

      {/* Outer Rim Highlight */}
      <div className="absolute inset-0 pointer-events-none rounded-[50px] border border-white/5 z-[60]" />
    </div>
  );
}
