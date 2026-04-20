"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

export default function RealityUIProvider() {
  useEffect(() => {
    const handleMutation = (e: CustomEvent<{ action: string }>) => {
      const { action } = e.detail;
      
      console.log("[Reality Engine] Received Action:", action);

      if (action === "theme_dark") {
        document.documentElement.style.setProperty("--zenith-black", "#050505");
        document.documentElement.style.setProperty("--brand-primary", "#C5A059");
        document.body.style.fontFamily = "'IBM Plex Sans Arabic', sans-serif";
        console.log("Applied Dark Luxury Mutation");
      } else if (action === "theme_classic") {
        document.documentElement.style.setProperty("--zenith-black", "#1a0f0a");
        document.documentElement.style.setProperty("--brand-primary", "#d4af37");
        document.body.style.fontFamily = "'Playfair Display', serif";
        console.log("Applied Classic Royal Mutation");
      } else if (action === "trigger_scarcity") {
        document.body.style.transition = "filter 0.5s, transform 0.5s";
        document.body.style.filter = "contrast(1.1) brightness(0.9)";
        console.log("Applied Scarcity Filter");
      }
    };

    window.addEventListener("azenith_reality_mutation" as any, handleMutation);
    return () => window.removeEventListener("azenith_reality_mutation" as any, handleMutation);
  }, []);

  return null;
}
