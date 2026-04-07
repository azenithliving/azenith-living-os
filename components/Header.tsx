"use client";
import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    // 5 clicks detected - set secret flag and redirect to admin-gate
    if (newCount === 5) {
      sessionStorage.setItem("sovereign_access", "granted");
      window.location.href = "/admin-gate";
      return;
    }

    // Reset count after 1.5 seconds if no more clicks
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 1500);
  };

  return (
    <>
      {/* FROSTED GLASS EFFECT - ONLY BEHIND HEADER ELEMENTS */}
      <div className="fixed top-0 left-0 w-full z-40 h-20 bg-[#1A1A1B]/70 backdrop-blur-md border-b border-white/10 pointer-events-none" />
      
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-0 left-0 w-full z-[100] h-20 md:h-24 px-6 md:px-12 flex justify-between items-center overflow-visible"
      >
        {/* Desktop Navigation */}
        <nav dir="rtl" className="hidden md:flex gap-10 text-white font-medium text-sm">
          <Link href="/" className="hover:text-[#C5A059] transition-colors">إرثنا</Link>
          <Link href="/rooms" className="hover:text-[#C5A059] transition-colors">استكشف المساحات</Link>
          <Link href="/contact" className="hover:text-[#C5A059] transition-colors">تواصل معنا</Link>
        </nav>

        {/* Mobile Hamburger Menu */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden relative w-8 h-8 flex flex-col justify-center items-center gap-1.5 z-50"
        >
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>

        {/* اليسار: اللوجو (logo.png) with Secret Gate */}
        <div className="flex items-center h-full">
          <div 
            onClick={handleLogoClick}
            className="relative h-20 w-48 md:h-32 md:w-64 transition-transform duration-500 hover:scale-105 cursor-pointer select-none"
          >
            <Image
              src="/logo.png"
              alt="Azenith Logo"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 48px, 64px"
              priority
            />
          </div>
        </div>
      </motion.header>

      {/* Mobile Menu Slide-in */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            className="fixed top-20 md:top-24 right-0 left-0 w-full h-screen backdrop-blur-lg z-40 md:hidden"
          >
            <div className="flex flex-col items-end px-6 py-8 space-y-6" dir="rtl">
              <Link 
                href="/"
                onClick={closeMobileMenu}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                إرثنا
              </Link>
              <Link 
                href="/rooms"
                onClick={closeMobileMenu}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                استكشف المساحات
              </Link>
              <Link 
                href="/contact"
                onClick={closeMobileMenu}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                تواصل معنا
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
