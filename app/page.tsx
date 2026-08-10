"use client";

import { useEffect, useState } from "react";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";
import useSessionStore from "@/stores/useSessionStore";

const seoEntryLinks = [
  { href: "/seo/interior-design-egypt", label: "تصميم داخلي في مصر" },
  { href: "/seo/luxury-interior-design-cairo", label: "تصميم داخلي فاخر في القاهرة" },
  { href: "/seo/luxury-bedroom-design-cairo", label: "تصميم غرف نوم فاخرة" },
  { href: "/seo/modern-kitchen-design-egypt", label: "تصميم مطابخ مودرن" },
  { href: "/seo/living-room-interior-egypt", label: "تصميم صالات وغرف معيشة" },
  { href: "/seo/dressing-room-design-cairo", label: "تصميم دريسنج روم" },
  { href: "/seo/villa-finishing-interior-design", label: "تشطيب وتصميم فيلات" },
  { href: "/seo/custom-furniture-egypt", label: "أثاث مخصص فاخر" },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";

  // Proper Hydration fix: set mounted to true after initial render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Static runtime config with Arabic text
  const runtimeConfig = {
    brandName: "أزينث ليفينج",
    brandNameAr: "أزينث",
    brandNameEn: "Azenith Living",
    freeHookOffer: isRTL ? "تصميم مبدئي خلال 24 ساعة" : "Initial Design in 24 Hours",
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "201090819584",
    primaryDomain: null,
    contactEmail: "azenithliving@gmail.com",
    contactPhone: "201090819584",
    businessAddress: "السلام، القاهرة، مصر",
    logoPath: "/logo.png",
    faviconPath: "/favicon.png",
    primaryColor: "#C5A059",
    language: currentLang,
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
        {isRTL ? "تجاوز إلى المحتوى" : "Skip to content"}
      </a>

      <div className="fixed inset-0 w-full h-full -z-10">
        <AzenithLegacy />
      </div>

      <Hero />

      <div className="relative">
        <section className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/40 backdrop-blur-md md:mx-auto md:max-w-7xl">
          <div id="inventory-section" className="relative z-20 pt-8">
            <HomePageClient runtimeConfig={runtimeConfig} initialRoomImages={initialRoomImages} />
          </div>

          <section className="relative z-20 mx-auto max-w-6xl px-6 py-16 md:px-10" aria-labelledby="seo-entry-title">
            <div className="space-y-5 border-t border-white/10 pt-10">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Azenith Living Search Hub</p>
              <h2 id="seo-entry-title" className="font-serif text-3xl text-white md:text-5xl">
                تصميم داخلي فاخر في مصر يبدأ من فهم المساحة قبل اختيار الشكل.
              </h2>
              <p className="max-w-3xl text-sm leading-8 text-white/68 md:text-base">
                أزينث ليفينج تساعدك في تصميم غرف النوم، الصالات، المطابخ، الدريسنج، الفيلات، والأثاث المخصص بخطة واضحة تربط بين الجمال، الراحة، الميزانية، وقابلية التنفيذ.
              </p>
              <div className="flex flex-wrap gap-3">
                {seoEntryLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/75 transition hover:border-brand-primary hover:text-brand-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
