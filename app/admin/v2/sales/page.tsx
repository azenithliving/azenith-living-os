"use client";

/**
 * «مدير المبيعات» — the sales employee's house, not a room with his name on the door.
 *
 * The owner's word on ٣٠ سبتمبر: the office's body is the sales agent himself — the
 * same shape, the same style and the same way of using him he built — and everything
 * else about selling sits under him. So this page opens with his face: one voice he
 * speaks into, and under it his desk, which is the customer ledger counted by the one
 * shared rule. The money, the orders, the warehouse and the workshop are outside the
 * store's trade and are not on this page.
 */
import { Suspense } from "react";
import { Briefcase } from "lucide-react";
import { ChatPanel } from "@/components/admin/agents/ChatPanel";
import CustomersPanel from "@/components/admin/sales/CustomersPanel";

export default function V2SalesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/30 to-amber-700/20 border border-amber-500/30 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-amber-300" />
          </div>
          <span className="font-black text-sm text-white">مدير المبيعات</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
            كلّمه هو، وهو يفتح لك دفتر العملاء
          </span>
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        <section>
          <ChatPanel agentKey="vanguard" agentName="مدير المبيعات" swipeable />
        </section>
        <section>
          <Suspense fallback={<p className="text-sm text-white/40 p-8">جاري تحميل كشف العملاء...</p>}>
            <CustomersPanel />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
