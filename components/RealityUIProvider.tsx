"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";

export default function RealityUIProvider() {
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const sessionId = localStorage.getItem("azenith_session_id");

    if (!sessionId) return;

    // اشتراك لحظي في تحولات الواقع الخاصة بهذا العميل فقط
    const channel = supabase
      .channel(`reality_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reality_mutations",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const mutation = payload.new;
          console.log("[Reality Engine] Incoming Mutation:", mutation);

          if (mutation.type === "FATE_ACTION") {
            handleFateAction(mutation.action);
          } else {
            handleMutation(mutation.action);
          }
        }
      )
      .subscribe();

    const handleMutation = (action: string) => {
      if (action === "theme_dark") {
        document.documentElement.style.setProperty("--zenith-black", "#050505");
        document.documentElement.style.setProperty("--brand-primary", "#C5A059");
        document.body.style.fontFamily = "'IBM Plex Sans Arabic', sans-serif";
      } else if (action === "theme_classic") {
        document.documentElement.style.setProperty("--zenith-black", "#1a0f0a");
        document.documentElement.style.setProperty("--brand-primary", "#d4af37");
        document.body.style.fontFamily = "'Playfair Display', serif";
      }
    };

    const handleFateAction = (action: string) => {
      if (action === "THUNDER") {
        // تأثير الصاعقة: وميض أبيض + اهتزاز + عرض خصم
        const flash = document.createElement("div");
        flash.className = "fixed inset-0 bg-white z-[9999] pointer-events-none transition-opacity duration-300";
        document.body.appendChild(flash);
        setTimeout(() => { 
            if(flash) flash.style.opacity = "0"; 
            setTimeout(() => flash.remove(), 300); 
        }, 50);
        
        toast.success("⚡ صاعقة الحظ! حصلت على خصم 15% لمدة دقيقة واحدة فقط!", {
          duration: 10000,
          icon: '💎',
          style: { background: '#1a1a1a', color: '#C5A059', border: '1px solid #C5A059' }
        });
      } else if (action === "HALLUCINATION") {
        // تأثير الهلوسة: رسائل وهمية للضغط النفسي
        toast("🔥 هناك 4 أشخاص آخرين يشاهدون هذا التصميم الآن!", {
          icon: '👁️',
          style: { background: '#0A0A0A', color: '#fff', border: '1px solid #ffffff20' }
        });
      } else if (action === "FREEZE") {
        // تأثير التجميد: قفل الواجهة
        setIsFrozen(true);
      } else if (action === "QUANTUM_OFFER") {
        // تأثير العرض الوهمي: عداد تنازلي للضغط النفسي
        showQuantumOffer();
      }
    };

    const showQuantumOffer = () => {
        const timerContainer = document.createElement("div");
        timerContainer.className = "fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-red-600/50 border-2 border-white/20 flex flex-col items-center animate-bounce";
        timerContainer.innerHTML = `
            <div class="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Quantum Discount Activated</div>
            <div class="text-3xl font-black tabular-nums tracking-tighter" id="quantum-clock">03:00</div>
            <div class="text-[11px] font-bold mt-1 text-center">خصم 25% خاص بك ينتهي الآن! اطلبه في الشات</div>
        `;
        document.body.appendChild(timerContainer);

        let seconds = 180;
        const interval = setInterval(() => {
            seconds--;
            if (seconds <= 0) {
                clearInterval(interval);
                timerContainer.remove();
            }
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            const clock = document.getElementById("quantum-clock");
            if (clock) clock.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            if (seconds < 30 && clock) clock.style.color = "#ffdd00";
        }, 1000);

        toast("⚠️ عرض سري! لقد تم اختيارك للحصول على خصم استثنائي، اطلبه من المستشار الآن قبل انتهاء الوقت!", {
            duration: 10000,
            icon: '💸',
            style: { background: '#991b1b', color: '#fff', border: '2px solid #ef4444' }
        });
    };

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isFrozen) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="max-w-md space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059]/20 blur-3xl animate-pulse" />
            <div className="relative h-24 w-24 mx-auto border-2 border-[#C5A059] rounded-full flex items-center justify-center animate-spin">
              <div className="h-16 w-16 border-2 border-[#C5A059]/30 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 bg-[#C5A059] rounded-full animate-ping" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-white tracking-[0.2em] uppercase">Control Protocol</h2>
            <p className="text-[#C5A059] text-lg font-medium animate-pulse">
                يتم الآن مراجعة ملفك الشخصي من قبل الإدارة العليا لتقديم عرض لا يمكن رفضه.
                <br/>
                <span className="text-white/40 text-sm mt-4 block">يرجى عدم إغلاق الصفحة لضمان استمرارية العملية...</span>
            </p>
          </div>
          <button 
            onClick={() => setIsFrozen(false)}
            className="text-[10px] text-white/5 hover:text-white/20 transition tracking-tighter"
          >
            (BYPASS_PROTO_99)
          </button>
        </div>
      </div>
    );
  }

  return null;
}
