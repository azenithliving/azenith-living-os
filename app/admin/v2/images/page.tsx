"use client";

/**
 * «بنك الصور» — the store's own picture record, seated in the new house.
 *
 * The old landing held this panel inside a 600-line overview page and printed the harvest log's
 * machine status in English. Here it is one screen that answers one question — how many pictures the
 * store really holds and how they are spread over the rooms — read from the guarded door that already
 * owns that count.
 */
import { Images } from "lucide-react";
import ImageBankPanel from "@/components/admin/images/ImageBankPanel";

export default function V2ImagesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
            <Images className="w-4 h-4 text-amber-300" />
          </div>
          <h1 className="font-black text-sm text-white">بنك الصور</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
            العدد من السجل، مش من الدرج
          </span>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <ImageBankPanel />
      </div>
    </div>
  );
}
