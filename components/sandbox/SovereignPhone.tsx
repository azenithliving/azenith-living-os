"use client";

import React, { useState } from 'react';
import { Monitor } from 'lucide-react';

interface SovereignPhoneProps {
  onToggleDevice?: () => void;
}

export default function SovereignPhone({ onToggleDevice }: SovereignPhoneProps) {
  const [mode, setMode] = useState<'browser' | 'android'>('browser');

  // روابط افتراضية (يمكنك تغييرها لاحقاً برابط الـ Redroid)
  const browserUrl = process.env.NEXT_PUBLIC_NEKO_URL || "https://www.google.com/search?igu=1";
  const androidUrl = "https://chrome.browserless.io/"; // سنضع هنا رابط الأندرويد لاحقاً

  return (
    <div
      className="relative select-none mx-auto"
      style={{
        height: 'min(90vh, 720px)',
        aspectRatio: '9/19.5',
        width: 'auto',
        filter: 'drop-shadow(0 60px 120px rgba(0,0,0,0.95))',
      }}
    >
      {/* ── TITANIUM BODY ── */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: '50px',
          background: 'linear-gradient(160deg, #4b4845 0%, #38352f 30%, #1e1c18 65%, #2c2a26 100%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      />

      {/* ── INTERACTIVE SIDE BUTTONS ── */}
      {/* Power Button (Right Side) - Switches Mode Browser/Android */}
      <button 
        onClick={() => setMode(mode === 'browser' ? 'android' : 'browser')}
        className="absolute z-50 hover:brightness-125 active:scale-95 transition-all"
        style={{ right: '-2px', top: '22%', width: '4px', height: '13%', borderRadius: '0 2px 2px 0', background: '#3e3c38', border: '1px solid rgba(0,0,0,0.5)' }}
        title="Switch Mode (Browser/Android)"
      />

      {/* Action Button (Left Side) - Switches back to Computer */}
      <button 
        onClick={onToggleDevice}
        className="absolute z-50 hover:brightness-125 active:scale-95 transition-all"
        style={{ left: '-2px', top: '16%', width: '4px', height: '5%', borderRadius: '2px 0 0 2px', background: '#C5A059', border: '1px solid rgba(0,0,0,0.5)' }}
        title="Switch to Computer"
      >
        <Monitor size={6} className="absolute inset-0 m-auto text-black opacity-40" />
      </button>

      {/* Volume Buttons (Left Side) */}
      <div className="absolute" style={{ left: '-2px', top: '23%', width: '3px', height: '9%', borderRadius: '2px 0 0 2px', background: '#3e3c38' }} />
      <div className="absolute" style={{ left: '-2px', top: '34%', width: '3px', height: '9%', borderRadius: '2px 0 0 2px', background: '#3e3c38' }} />

      {/* ── SCREEN AREA ── */}
      <div
        className="absolute"
        style={{
          inset: '6px',
          borderRadius: '44px',
          background: '#000',
          overflow: 'hidden',
        }}
      >
        {/* Content Stream */}
        <div className="absolute inset-0 w-full h-full z-10 bg-white">
          <div className="relative w-full h-full overflow-hidden">
             <iframe
                key={mode} // Forced refresh on switch
                src={mode === 'browser' ? browserUrl : androidUrl}
                className="absolute border-0"
                style={{ 
                  width: '200%', height: '200%', 
                  top: 0, left: 0,
                  transform: 'scale(0.5)', transformOrigin: 'top left',
                }}
                allow="autoplay; fullscreen"
              />
          </div>
        </div>

        {/* Dynamic Island Overlay */}
        <div className="absolute z-40 pointer-events-none" style={{
          top: '12px', left: '50%', transform: 'translateX(-50%)',
          width: '90px', height: '28px',
          borderRadius: '14px', background: '#000',
        }}>
           {/* MODE INDICATOR IN DYNAMIC ISLAND */}
           <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[6px] font-bold text-white/40 uppercase tracking-widest">
                {mode === 'browser' ? 'Sovereign Web' : 'Sovereign Droid'}
              </span>
           </div>
        </div>

        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/20 rounded-full z-50 pointer-events-none" />
      </div>

    </div>
  );
}
