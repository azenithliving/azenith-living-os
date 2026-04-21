"use client";

import { motion } from "framer-motion";
import { Code, Terminal, Beaker } from "lucide-react";
import { ArchitectWidget } from "@/components/admin/ArchitectWidget";
import LatestTool from "@/components/sandbox/LatestTool";
import { SingularityContainment } from "@/components/sandbox/SingularityContainment";

export default function SandboxPage() {
  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#C5A05920,transparent_70%)]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#ffffff10 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex items-center gap-4 border-b border-white/10 pb-8 mb-8">
          <div className="p-4 bg-[#C5A059]/10 rounded-2xl border border-[#C5A059]/30">
            <Beaker className="h-8 w-8 text-[#C5A059]" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase">
              Admin <span className="text-[#C5A059]">Containment</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Sovereign Neural Sandbox - Operational Isolation Mode Active.
            </p>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-8 rounded-3xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center gap-3 mb-6">
              <Code className="h-6 w-6 text-[#C5A059]" />
              <h2 className="text-xl font-bold">Dimensional Engine Sandbox</h2>
            </div>
            
            <div className="p-8 rounded-xl bg-black border border-dashed border-[#C5A059]/50 min-h-[400px] relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-mono text-indigo-500 tracking-widest uppercase">Admin Secure Node</span>
              </div>
              
              <div className="pt-8">
                {/* ISOLATED EXECUTION ZONE */}
                <SingularityContainment>
                  <LatestTool />
                </SingularityContainment>
              </div>
            </div>
          </motion.div>
        </main>
      </div>

      <ArchitectWidget />
    </div>
  );
}
