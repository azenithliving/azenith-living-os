"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Shield, Brain, Globe, Menu, X, Bot, Factory, Crown } from "lucide-react";
import { FloatingAgentButton } from "@/components/admin/agents/FloatingAgentButton";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Shield,
  Brain,
  Globe,
  Bot,
  Factory,
  Crown,
};

const navItems = [
  { href: "/admin", label: "الرئيسية", icon: "Home" },
  { href: "/admin/agents", label: "الـ Agents", icon: "Bot" },
  { href: "/admin/manufacturing", label: "التصنيع", icon: "Factory" },
  { href: "/admin/owner-dashboard", label: "لوحة المالك", icon: "Crown" },
  { href: "/admin/sales", label: "المبيعات", icon: "Shield" },
  { href: "/admin/intel", label: "الاستخبارات", icon: "Brain" },
  { href: "/admin/browser", label: "Browser", icon: "Globe" },
];

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuState, setMobileMenuState] = useState({
    isOpen: false,
    pathname: "",
  });
  const isMobileMenuOpen =
    mobileMenuState.isOpen && mobileMenuState.pathname === (pathname || "");

  const openMobileMenu = () => {
    setMobileMenuState({
      isOpen: true,
      pathname: pathname || "",
    });
  };

  const closeMobileMenu = () => {
    setMobileMenuState((current) =>
      current.isOpen ? { ...current, isOpen: false } : current
    );
  };

  // إغلاق القائمة عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex overflow-hidden">
      {/* زر القائمة - يظهر دائماً */}
      <button
        onClick={openMobileMenu}
        className="fixed top-4 right-4 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#C5A059] text-[#1a1a1a] shadow-lg shadow-[#C5A059]/30 transition-all active:scale-95 hover:bg-[#D4B16A]"
        aria-label="فتح القائمة"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay للخلفية - يظهر عند فتح القائمة */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar - Drawer دائماً لجميع الشاشات */}
      <aside
        className={`
          fixed inset-y-0 right-0 z-50
          w-[280px]
          border-l border-white/10 bg-[#0A0A0A]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header مع زر الإغلاق */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#C5A059]">AZENITH</h1>
            <p className="text-xs text-white/50 mt-1">لوحة التحكم</p>
          </div>
          <button
            onClick={closeMobileMenu}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const IconComponent = iconMap[item.icon];

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileMenu}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[48px]
                  ${isActive
                    ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                {IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0" />}
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            أزينث ليفينج © 2025
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto h-screen">
        {children}
      </main>

      {/* Floating Agent Button - Always visible */}
      <FloatingAgentButton />
    </div>
  );
}
