"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";

export default function RealityUIProvider() {
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeCountdown, setFreezeCountdown] = useState(10);
  const [freezeOffer, setFreezeOffer] = useState("تم تحضير عرض استثنائي خاص بك! اسألني الآن عن التفاصيل.");

  useEffect(() => {
    const supabase = createClient();
    const sessionId = localStorage.getItem("azenith_session_id");

    if (!sessionId) return;

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
          const mutation = payload.new as { type: string; action: string };
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
        const flash = document.createElement("div");
        flash.className = "fixed inset-0 bg-white z-[9999] pointer-events-none transition-opacity duration-300";
        document.body.appendChild(flash);
        setTimeout(() => {
          if (flash) flash.style.opacity = "0";
          setTimeout(() => flash.remove(), 300);
        }, 50);
        toast.success("⚡ صاعقة الحظ! حصلت على خصم 15% لمدة دقيقة واحدة فقط!", {
          duration: 10000,
          icon: "💎",
          style: { background: "#1a1a1a", color: "#C5A059", border: "1px solid #C5A059" },
        });
      } else if (action === "HALLUCINATION") {
        toast("🔥 هناك 4 أشخاص آخرين يشاهدون هذا التصميم الآن!", {
          icon: "👁️",
          style: { background: "#0A0A0A", color: "#fff", border: "1px solid #ffffff20" },
        });
      } else if (action === "FREEZE") {
        // قرأ نص العرض من الـ payload وخزنه للاستخدام بعد العداد
        const offerText = (mutation as any).payload?.offerText || 
          "تم تحضير عرض استثنائي خاص بك من الإدارة العليا! اسألني الآن عن التفاصيل.";
        setFreezeOffer(offerText);
        setIsFrozen(true);
      } else if (action === "QUANTUM_OFFER") {
        showQuantumOffer();
      }
    };

    const showQuantumOffer = () => {
      const timerContainer = document.createElement("div");
      timerContainer.className =
        "fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl shadow-red-600/50 border-2 border-white/20 flex flex-col items-center animate-bounce";
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
        if (clock) clock.innerText = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        if (seconds < 30 && clock) clock.style.color = "#ffdd00";
      }, 1000);
      toast("⚠️ عرض سري! لقد تم اختيارك للحصول على خصم استثنائي، اطلبه من المستشار الآن قبل انتهاء الوقت!", {
        duration: 10000,
        icon: "💸",
        style: { background: "#991b1b", color: "#fff", border: "2px solid #ef4444" },
      });
    };

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // عداد تنازلي للتجميد — 10 ثوانٍ ثم فتح الشات بنص العرض المخصص
  useEffect(() => {
    if (!isFrozen) return;
    setFreezeCountdown(10);
    let count = 10;
    const interval = setInterval(() => {
      count--;
      setFreezeCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        setIsFrozen(false);
        // فتح الشات برسالة العرض الذي كتبه الأدمن حرفياً
        window.dispatchEvent(
          new CustomEvent("fate:open_chat", {
            detail: { message: freezeOffer },
          })
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isFrozen, freezeOffer]);

  if (isFrozen) {
    const progress = (freezeCountdown / 10) * 100;
    const circumference = 2 * Math.PI * 44;
    return (
      <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          {/* دائرة العداد التنازلي */}
          <div className="relative h-28 w-28 mx-auto">
            <div className="absolute inset-0 bg-[#C5A059]/20 blur-3xl animate-pulse rounded-full" />
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="none" stroke="#C5A05930" strokeWidth="5" />
              <circle
                cx="48" cy="48" r="44" fill="none" stroke="#C5A059" strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${circumference * (1 - progress / 100)}`}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#C5A059] text-3xl font-black">{freezeCountdown}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase">
              Control Protocol
            </h2>
            <p className="text-[#C5A059] text-base font-medium animate-pulse leading-relaxed">
              يتم الآن تحضير عرض استثنائي خاص بك من الإدارة العليا...
            </p>
            <p className="text-white/30 text-xs">
              سيظهر العرض خلال {freezeCountdown} ثانية تلقائياً
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
