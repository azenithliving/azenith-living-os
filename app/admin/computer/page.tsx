"use client";

import { useState } from "react";
import SovereignOS from "@/components/sandbox/SovereignOS";
import SovereignPhone from "@/components/sandbox/SovereignPhone";
import { AnimatePresence, motion } from "framer-motion";

export default function ComputerPage() {
  // 'computer' or 'phone'
  const [activeDevice, setActiveDevice] = useState<'computer' | 'phone'>('computer');

  return (
    <div className="min-h-screen bg-[#08080a] flex flex-col items-center justify-center p-4 overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,160,89,0.05),transparent_70%)]" />

      <AnimatePresence mode="wait">
        {activeDevice === 'computer' ? (
          <motion.div
            key="computer"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -20 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className="w-full flex justify-center"
          >
            <SovereignOS onToggleDevice={() => setActiveDevice('phone')} />
          </motion.div>
        ) : (
          <motion.div
            key="phone"
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 100 }}
            transition={{ duration: 0.5, ease: "backOut" }}
            className="w-full flex justify-center"
          >
            <SovereignPhone onToggleDevice={() => setActiveDevice('computer')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      <div className="absolute bottom-10 flex flex-col items-center gap-2 pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.6em] text-white/10 font-black">
          Sovereign Node Interface
        </div>
        <div className="h-[1px] w-12 bg-white/5" />
      </div>
    </div>
  );
}
