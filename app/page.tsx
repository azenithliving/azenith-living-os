"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";
import { TranslatedText } from "@/components/TranslatedText";
import useSessionStore from "@/stores/useSessionStore";
import { getTranslation } from "@/lib/multilingual-engine";

// BYPASS: Force render immediately without server-side blocking
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const language = useSessionStore((state) => state.language);

  // KILL SWITCH: Force mount after 1 second max
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn("[BYPASS] Forcing mount after 1s");
      setMounted(true);
    }, 1000);

    setMounted(true); // Also set immediately

    return () => clearTimeout(timer);
  }, []);

  // Translation helper
  const t = (key: string) => getTranslation(key, language);

  // Static runtime config (bypasses server fetch)
  const runtimeConfig = {
    brandName: language === "ar" ? "أزينث ليفينج" : "Azenith Living",
    brandNameAr: "أزينث ليفينج",
    brandNameEn: "Azenith Living",
    freeHookOffer: language === "ar" ? "تصميم مبدئي خلال 24 ساعة" : "Initial Design in 24 Hours",
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "201090819584",
    primaryDomain: null,
    contactEmail: "azenithliving@gmail.com",
    contactPhone: "201090819584",
    businessAddress: language === "ar" ? "السلام، القاهرة، مصر" : "Al-Salam, Cairo, Egypt",
    logoPath: "/logo.png",
    faviconPath: "/favicon.png",
    primaryColor: "#C5A059",
    language,
  };

  // Empty initial images (client will fetch)
  const initialRoomImages = {};

  // Minimal placeholder while mounting (avoids hydration mismatch)
  if (!mounted) {
    return (
      <div style={{ background: '#000', height: '100vh', width: '100vw' }} />
    );
  }

  return (
    <main id="main-content" className="relative min-h-screen">
      <a
        href="#inventory-section"
        className="sr-only absolute right-4 top-4 z-[120] rounded-full bg-white px-4 py-2 text-sm font-medium text-black focus:not-sr-only"
      >
        <TranslatedText>{language === "ar" ? "تجاوز إلى المحتوى" : "Skip to content"}</TranslatedText>
      </a>

      <Header />

      <div className="fixed inset-0 w-full h-full -z-10">
        <AzenithLegacy />
      </div>

      <Hero />

      <div className="relative">
        <section className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/40 backdrop-blur-md md:mx-auto md:max-w-7xl">
          <div id="inventory-section" className="relative z-20 pt-8">
            <HomePageClient runtimeConfig={runtimeConfig} initialRoomImages={initialRoomImages} />
          </div>
        </section>
      </div>
    </main>
  );
}
