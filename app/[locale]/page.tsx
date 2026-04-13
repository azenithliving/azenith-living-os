"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from 'next-intl';
import Header from "@/components/Header";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const locale = useLocale();
  const t = useTranslations('HomePage');

  // KILL SWITCH: Force mount after 1 second max
  useEffect(() => {
    const timer = setTimeout(() => {
      console.warn("[BYPASS] Forcing mount after 1s");
      setMounted(true);
    }, 1000);

    setMounted(true); // Also set immediately

    return () => clearTimeout(timer);
  }, []);

  // Static runtime config
  const runtimeConfig = {
    brandName: t('brandName'),
    brandNameAr: t('brandNameAr'),
    brandNameEn: "Azenith Living",
    freeHookOffer: t('freeHookOffer'),
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "201090819584",
    primaryDomain: null,
    contactEmail: t('contact.email'),
    contactPhone: "201090819584",
    businessAddress: t('contact.address'),
    logoPath: "/logo.png",
    faviconPath: "/favicon.png",
    primaryColor: "#C5A059",
    language: locale,
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
        {t('skipToContent')}
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
