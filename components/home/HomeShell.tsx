"use client";

import { useEffect, useState } from "react";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";
import useSessionStore from "@/stores/useSessionStore";
import type { RuntimeConfig } from "@/lib/runtime-config";

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

/**
 * The home page shell. The store's own record answers for the phone number (the page used to read a
 * build-time variable that is not set on the published site, which is why the home page carried no
 * WhatsApp link at all); everything here is what only a browser can do.
 */
export default function HomeShell({ config }: { config: RuntimeConfig }) {
  const [mounted, setMounted] = useState(false);
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";

  useEffect(() => {
    setMounted(true);
  }, []);

  const runtimeConfig: RuntimeConfig & { brandNameEn: string; language: string } = {
    ...config,
    brandName: "أزينث ليفينج",
    brandNameAr: "أزينث",
    brandNameEn: "Azenith Living",
    freeHookOffer: isRTL ? "استشارة تصميم مبدئية" : "Initial design consultation",
    language: currentLang,
  };

  const initialRoomImages = {};

  // The crawlable document must not depend on JavaScript: the words are server-rendered and only the
  // parts that genuinely need a browser wait for it.
  return (
    <main id="main-content" className="relative min-h-screen">
      <a
        href="#inventory-section"
        className="sr-only absolute right-4 top-4 z-[120] rounded-full bg-white px-4 py-2 text-sm font-medium text-black focus:not-sr-only"
        suppressHydrationWarning
      >
        {isRTL ? "تجاوز إلى المحتوى" : "Skip to content"}
      </a>

      {mounted && (
        <div className="fixed inset-0 w-full h-full -z-10">
          <AzenithLegacy />
        </div>
      )}

      <Hero />

      <div className="relative">
        <section className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/40 backdrop-blur-md md:mx-auto md:max-w-7xl">
          <div id="inventory-section" className="relative z-20 pt-8">
            {mounted && <HomePageClient runtimeConfig={runtimeConfig} initialRoomImages={initialRoomImages} />}
          </div>

          <section className="relative z-20 mx-auto max-w-6xl px-6 py-16 md:px-10" aria-labelledby="seo-entry-title">
            <div className="space-y-5 border-t border-white/10 pt-10">
              <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">مركز تصفّح أزينث ليفينج</p>
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
