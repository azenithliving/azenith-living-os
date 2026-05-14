"use client";

import { motion } from "framer-motion";
import { Sparkles, Zap, EyeOff, Ghost, Clock } from "lucide-react";
import { useState } from "react";

export default function FateControlPage() {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const actions = [
    { id: "QUANTUM_OFFER", name: "العرض الكمي (Quantum Offer)", icon: Sparkles, color: "text-amber-400", description: "تفعيل عرض خصم 25% فوري بضغطة واحدة." },
    { id: "THUNDER", name: "الصاعقة (Thunder)", icon: Zap, color: "text-yellow-400", description: "إطلاق صاعقة بصرية وخصم 15% فوري." },
    { id: "HALLUCINATION", name: "الإيهام (Hallucination)", icon: EyeOff, color: "text-purple-400", description: "إيهام العميل بوجود منافسين يشاهدون نفس التصميم." },
    { id: "FREEZE", name: "التجميد (Freeze)", icon: Ghost, color: "text-blue-400", description: "تجميد الشاشة لإجبار العميل على التركيز على عرض معين." },
  ];

  const triggerAction = async (actionId: string) => {
    setActiveAction(actionId);
    try {
      await fetch("/api/admin/fate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionId, active: true })
      });
      alert(`تم تفعيل ${actionId} بنجاح!`);
    } catch (e) {
      alert("فشل تفعيل الأمر");
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-black text-white mb-2 flex items-center gap-3">
          <Sparkles className="text-amber-500" /> التحكم في القدر (Fate Control)
        </h1>
        <p className="text-white/50">تحكم في تجربة العميل في الوقت الفعلي باستخدام أوامر القدر الاستثنائية.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {actions.map((action) => (
          <motion.div
            key={action.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl bg-white/5 ${action.color}`}>
                <action.icon className="w-6 h-6" />
              </div>
              <button
                onClick={() => triggerAction(action.id)}
                disabled={activeAction === action.id}
                className="px-6 py-2 rounded-xl bg-[#C5A059] text-black font-bold hover:bg-[#D4B16A] transition-all disabled:opacity-50"
              >
                {activeAction === action.id ? "جاري الإرسال..." : "تفعيل الآن"}
              </button>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{action.name}</h3>
            <p className="text-white/40 text-sm">{action.description}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 p-8 rounded-[2.5rem] border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-4 mb-4">
          <Clock className="text-amber-500" />
          <h2 className="text-xl font-bold text-white">سجل العمليات القدرية</h2>
        </div>
        <div className="text-white/30 text-sm text-center py-10">
          لا يوجد عمليات نشطة حالياً.
        </div>
      </div>
    </div>
  );
}
