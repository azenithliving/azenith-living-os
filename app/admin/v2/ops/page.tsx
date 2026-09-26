'use client';

import { StudioPanel } from '@/components/admin/ops/StudioPanel';
import Link from 'next/link';
import { Crown, ArrowRight } from 'lucide-react';

export default function V2QayyimPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <Link href="/admin/v2/agents" className="flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white/70">
            <ArrowRight className="w-3.5 h-3.5" /> مركز قيادة الوكلاء
          </Link>
          <span className="text-white/20">/</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-300" />
            </div>
            <span className="font-black text-sm text-white">قيّم الدار — الاستوديو</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-mono">8 وكلاء بدستور واحد</span>
          </div>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <StudioPanel />
      </div>
    </div>
  );
}
