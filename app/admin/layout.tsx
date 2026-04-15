"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { MessageSquare, Home, Settings, Users, BarChart3, Briefcase, Globe, Target, Crown, Menu, X } from "lucide-react";

const navItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/sales-manager", label: "مدير المبيعات", icon: Briefcase },
  { href: "/admin/site-manager", label: "مدير الموقع", icon: Globe },
  { href: "/admin/war-room", label: "غرفة العمليات", icon: Target },
  { href: "/admin/architect", label: "المهندس المعماري", icon: Settings },
  { href: "/admin/chat", label: "مركز القيادة", icon: Crown },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // إغلاق القائمة عند تغيير الصفحة
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // إغلاق القائمة عند الضغط على Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* زر الهمبرغر - يظهر فقط على الشاشات الصغيرة */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#C5A059] text-[#1a1a1a] shadow-lg shadow-[#C5A059]/30 transition-all active:scale-95"
        aria-label="فتح القائمة"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay للخلفية - يظهر عند فتح القائمة على الموبايل */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: ظاهرة دائماً, Mobile: Drawer من اليمين */}
      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-50
          w-[280px] lg:w-64
          border-l border-white/10 bg-[#0A0A0A]
          flex-col
          transform transition-transform duration-300 ease-in-out
          lg:transform-none lg:flex
          ${isMobileMenuOpen ? "flex translate-x-0" : "hidden translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header مع زر الإغلاق للموبايل */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#C5A059]">AZENITH</h1>
            <p className="text-xs text-white/50 mt-1">لوحة التحكم</p>
          </div>
          {/* زر إغلاق للموبايل */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-colors min-h-[48px]
                  ${isActive
                    ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
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

      {/* Main Content - مع padding علوي للموبايل بسبب زر الهمبرغر */}
      <main className="flex-1 overflow-auto lg:pt-0 pt-16">
        {children}
      </main>
    </div>
  );
}
