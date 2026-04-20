"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function RealityUIProvider() {
  useEffect(() => {
    const handleMutation = (e: CustomEvent<{ action: string }>) => {
      const { action } = e.detail;
      
      console.log("[Reality Engine] Received Action:", action);

      if (action === "theme_dark") {
        document.body.style.setProperty("--zenith-black", "#050505");
        document.body.style.setProperty("--brand-primary", "#C5A059");
        toast("تم تفعيل وضع الفخامة 🌑", { icon: "🔮", style: { background: "#000", color: "#C5A059" } });
      } else if (action === "theme_classic") {
        document.body.style.setProperty("--zenith-black", "#2c1c11"); // Deep wood color
        document.body.style.setProperty("--brand-primary", "#e2a964");
        toast("تم تحويل التصميم إلى النمط الكلاسيكي 🏛️", { icon: "🔮", style: { background: "#2c1c11", color: "#e2a964" } });
      } else if (action === "trigger_scarcity") {
        // Visual flash or inject a scarcity banner
        document.body.style.transition = "filter 0.5s";
        document.body.style.filter = "contrast(1.2)";
        setTimeout(() => {
            document.body.style.filter = "none";
        }, 1000);
        toast("عرض حصري متاح الآن لفترة محدودة! ⏳", { icon: "⚡", style: { background: "#C5A059", color: "#000" } });
      }
    };

    window.addEventListener("azenith_reality_mutation" as any, handleMutation);
    return () => window.removeEventListener("azenith_reality_mutation" as any, handleMutation);
  }, []);

  return null;
}
