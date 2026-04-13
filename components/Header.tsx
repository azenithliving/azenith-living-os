"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import useSessionStore from "@/stores/useSessionStore";

const SOVEREIGN_ACCESS_KEY = "sovereign_access";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Use session store for language state
  const currentLang = useSessionStore((state) => state.language);
  const setLanguage = useSessionStore((state) => state.setLanguage);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  const handleLanguageChange = (lang: 'ar' | 'en') => {
    if (lang === currentLang) return;
    setLanguage(lang);
    // Refresh page to apply language changes
    router.refresh();
  };

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount === 5) {
      sessionStorage.setItem(SOVEREIGN_ACCESS_KEY, "granted");
      router.push("/admin-gate");
      return;
    }

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1500);
  };

  return (
    <>
      <div className="pointer-events-none fixed left-0 top-0 z-40 h-20 w-full border-b border-white/10 bg-[#1A1A1B]/70 backdrop-blur-md" />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed left-0 top-0 z-[100] flex h-20 w-full items-center justify-between overflow-visible px-6 md:h-24 md:px-12"
      >
        <nav dir="rtl" className="hidden items-center gap-8 text-sm font-medium text-white md:flex">
          <Link href="/about" className="transition-colors hover:text-[#C5A059]">
            من نحن
          </Link>
          <Link href="/rooms" className="transition-colors hover:text-[#C5A059]">
            المساحات
          </Link>
          <Link href="/request" className="transition-colors hover:text-[#C5A059]">
            تواصل معنا
          </Link>
          <div className="flex items-center gap-2 border border-[#C5A059]/30 rounded-lg px-3 py-1">
            <button
              onClick={() => handleLanguageChange('ar')}
              className={`text-sm ${currentLang === 'ar' ? 'text-[#C5A059] font-bold' : 'text-white/60'}`}
            >
              AR
            </button>
            <span className="text-white/30">|</span>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`text-sm ${currentLang === 'en' ? 'text-[#C5A059] font-bold' : 'text-white/60'}`}
            >
              EN
            </button>
          </div>
        </nav>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          aria-label={isMobileMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={isMobileMenuOpen}
          className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span className={`h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>

        <div className="flex h-full items-center">
          <button
            type="button"
            onClick={handleLogoClick}
            className="relative h-20 w-48 cursor-pointer select-none transition-transform duration-500 hover:scale-105 md:h-32 md:w-64"
          >
            <Image
              src="/logo.png"
              alt="Azenith Logo"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 48px, 64px"
              priority
            />
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMobileMenuOpen ? (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            className="fixed left-0 right-0 top-20 z-40 h-[calc(100dvh-5rem)] w-full overflow-y-auto backdrop-blur-lg md:hidden"
          >
            <div className="flex flex-col items-end space-y-6 px-6 py-8" dir="rtl">
              <Link href="/about" onClick={closeMobileMenu} className="text-lg font-light text-white transition-colors hover:text-[#C5A059]">
                من نحن
              </Link>
              <Link href="/rooms" onClick={closeMobileMenu} className="text-lg font-light text-white transition-colors hover:text-[#C5A059]">
                المساحات
              </Link>
              <Link href="/request" onClick={closeMobileMenu} className="text-lg font-light text-white transition-colors hover:text-[#C5A059]">
                تواصل معنا
              </Link>
              <div className="pt-4 border-t border-white/10 w-full flex justify-end">
                <div className="flex items-center gap-2 border border-[#C5A059]/30 rounded-lg px-3 py-1">
                  <button
                    onClick={() => handleLanguageChange('ar')}
                    className={`text-sm ${currentLang === 'ar' ? 'text-[#C5A059] font-bold' : 'text-white/60'}`}
                  >
                    AR
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    onClick={() => handleLanguageChange('en')}
                    className={`text-sm ${currentLang === 'en' ? 'text-[#C5A059] font-bold' : 'text-white/60'}`}
                  >
                    EN
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
