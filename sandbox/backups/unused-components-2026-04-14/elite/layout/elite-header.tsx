"use client";

/**
 * ELITE HEADER COMPONENT
 * Premium navigation header for Elite Layer
 * 
 * CLASSIFICATION: EXTEND
 * Extends existing Header component with Elite-specific features
 * - Adds Elite branding
 * - Adds user menu
 * - Maintains design consistency
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Crown, LogOut, User, ChevronDown } from "lucide-react";

interface EliteHeaderProps {
  userName?: string | null;
  onLogout?: () => void;
  showUserMenu?: boolean;
}

export function EliteHeader({ userName, onLogout, showUserMenu = false }: EliteHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <>
      {/* Premium Frosted Glass Background */}
      <div className="fixed top-0 left-0 w-full z-40 h-20 bg-gradient-to-b from-[#0A0A0A]/90 to-[#1A1A1B]/80 backdrop-blur-xl border-b border-[#C5A059]/20 pointer-events-none" />
      
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-0 left-0 w-full z-[100] h-20 md:h-24 px-6 md:px-12 flex justify-between items-center overflow-visible"
      >
        {/* Right: Navigation + Elite Badge */}
        <div dir="rtl" className="hidden md:flex items-center gap-8">
          <nav className="flex gap-8 text-white font-medium text-sm">
            <Link href="/elite" className="hover:text-[#C5A059] transition-colors">
              الرئيسية
            </Link>
            <Link href="/elite/dashboard" className="hover:text-[#C5A059] transition-colors">
              مركز المشروع
            </Link>
            <Link href="/rooms" className="hover:text-[#C5A059] transition-colors">
              استكشف المساحات
            </Link>
          </nav>
          
          {/* Elite Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#C5A059]/20 to-[#E5C170]/10 border border-[#C5A059]/30">
            <Crown className="h-4 w-4 text-[#C5A059]" />
            <span className="text-[#C5A059] text-xs font-bold tracking-wider">النخبة</span>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden relative w-8 h-8 flex flex-col justify-center items-center gap-1.5 z-50"
        >
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>

        {/* Left: Logo */}
        <div className="flex items-center h-full">
          <Link href="/elite" className="relative h-16 w-40 md:h-24 md:w-56 transition-transform duration-500 hover:scale-105">
            <Image
              src="/logo.png"
              alt="Azenith Elite"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 40px, 56px"
              priority
            />
          </Link>
        </div>

        {/* User Menu (Desktop) */}
        {showUserMenu && (
          <div className="hidden md:block relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A059] to-[#E5C170] flex items-center justify-center">
                <User className="h-4 w-4 text-black" />
              </div>
              <span className="text-white text-sm">{userName || "عميلنا الكريم"}</span>
              <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 mt-2 w-48 bg-[#1A1A1B] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                >
                  <button
                    onClick={() => {
                      onLogout?.();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/5 transition-colors text-right"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
            className="fixed top-20 md:top-24 right-0 left-0 w-full h-screen backdrop-blur-xl bg-[#0A0A0A]/95 z-40 md:hidden"
          >
            <div className="flex flex-col items-end px-6 py-8 space-y-6" dir="rtl">
              {/* Elite Badge Mobile */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#C5A059]/20 to-[#E5C170]/10 border border-[#C5A059]/30 mb-4">
                <Crown className="h-4 w-4 text-[#C5A059]" />
                <span className="text-[#C5A059] text-sm font-bold tracking-wider">النخبة</span>
              </div>
              
              <Link 
                href="/elite"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                الرئيسية
              </Link>
              <Link 
                href="/elite/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                مركز المشروع
              </Link>
              <Link 
                href="/rooms"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-white text-lg font-light hover:text-[#C5A059] transition-colors"
              >
                استكشف المساحات
              </Link>
              
              {showUserMenu && (
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsMobileMenuOpen(false);
                  }}
                  className="text-white/60 text-lg font-light hover:text-red-400 transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-5 w-5" />
                  تسجيل الخروج
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
