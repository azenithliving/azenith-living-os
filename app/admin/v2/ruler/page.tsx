"use client";

/**
 * «المِسطرة» — the owner's own answer to «وصلت فين؟ وفاضل قد إيه؟».
 *
 * Twelve phases, the atoms each one owns, what is dead and how it was classified, and what the
 * ledgers refused to answer. It reads the guarded door, so the number on this screen and the number
 * an agent reports cannot disagree.
 */
import { Ruler } from "lucide-react";

import RulerPanel from "@/components/admin/ruler/RulerPanel";

export default function V2RulerPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
            <Ruler className="w-4 h-4 text-amber-300" />
          </div>
          <h1 className="font-black text-sm text-white">المِسطرة</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
            من السجل، مش من الخطة
          </span>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <RulerPanel />
      </div>
    </div>
  );
}
