"use client";

import React from 'react';
import { Cpu, Terminal, Plus } from 'lucide-react';

export default function LatestTool() {
  return (
    /* SOVEREIGN ISOLATION CHAMBER v1.0 */
    <div className="w-full h-[800px] bg-[#020204] rounded-[40px] border border-white/5 flex flex-col relative overflow-hidden text-white font-sans">
      
      {/* THE ORANGE CONTAINMENT BORDER (THE SHIELD) */}
      <div className="absolute inset-0 border-2 border-[#C5A059]/20 rounded-[40px] pointer-events-none z-50 shadow-[inset_0_0_100px_rgba(197,160,89,0.05)]" />
      
      {/* Background Pulse */}
      <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full animate-pulse pointer-events-none" />
      
      {/* COMMAND HEADER */}
      <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/40 backdrop-blur-xl z-20">
         <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#C5A059] animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C5A059]">Isolated Core Active</span>
         </div>
         <div className="flex items-center gap-4">
            <div className="text-[9px] text-white/20 font-mono">ENCLAVE_ID: SN-01-DELTA</div>
            <button className="p-2 hover:bg-white/5 rounded-lg text-white/40 transition-colors"><Plus size={14} /></button>
         </div>
      </div>

      <div className="flex-1 relative z-10 flex flex-col items-center justify-center gap-8">
        <div className="w-32 h-32 rounded-full border border-white/10 bg-black/40 backdrop-blur-2xl flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,1)] relative group">
           <div className="absolute inset-0 rounded-full border border-[#C5A059]/20 animate-spin-slow" />
           <Cpu className="w-12 h-12 text-indigo-500/40 group-hover:text-indigo-400 transition-colors" />
        </div>
        
        <div className="text-center space-y-2">
           <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-white/90">Pure Slate Node</h2>
           <p className="text-xs text-white/30 font-medium uppercase tracking-widest max-w-sm leading-relaxed">
             Everything executed within this orange boundary is encapsulated. No leakage to core files.
           </p>
        </div>

        <div className="flex items-center gap-4">
          <button className="px-8 py-4 bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-2xl hover:bg-[#C5A059]/20 transition-all flex items-center gap-3 group">
             <Plus className="w-4 h-4 text-[#C5A059] group-hover:scale-110 transition-transform" />
             <span className="text-sm font-bold text-[#C5A059]">Initialize New Core</span>
          </button>
          <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-sm font-bold text-white/40">
             Load Blueprint
          </button>
        </div>
      </div>

      {/* FOOTER METRICS */}
      <div className="absolute bottom-12 left-12 right-12 flex items-center justify-between text-white/20 z-20">
         <div className="flex items-center gap-4">
            <Terminal size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Integrity: 100% | Isolation: Total</span>
         </div>
         <div className="text-[10px] font-mono opacity-50">Sovereign OS v3.0.1</div>
      </div>
    </div>
  );
}