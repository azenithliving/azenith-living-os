"use client";

/**
 * The sales office in the new house — the first window the consolidation program
 * opened with a real employee behind it.
 *
 * Until tonight this address was a signpost: sixteen lines apologising and pointing
 * back at the old page. The customers employee now lives here, and the old page
 * keeps working because the old house is erased last, not first.
 */
import { Suspense } from "react";
import { Users } from "lucide-react";
import CustomersPanel from "@/components/admin/sales/CustomersPanel";

export default function V2SalesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
            <Users className="w-4 h-4 text-amber-300" />
          </div>
          <span className="font-black text-sm text-white">مكتب المبيعات</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
            العملاء — أول موظف يسكن بيته
          </span>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <Suspense fallback={<p className="text-sm text-white/40 p-8">جاري تحميل كشف العملاء...</p>}>
          <CustomersPanel />
        </Suspense>
      </div>
    </div>
  );
}
