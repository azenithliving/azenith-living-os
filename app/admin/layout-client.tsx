"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Home, 
  Shield, 
  Brain, 
  Globe, 
  Menu, 
  X, 
  Bot, 
  Factory, 
  Crown, 
  Phone, 
  Monitor, 
  Code, 
  MessageSquare, 
  TrendingUp,
  Settings,
  Database,
  Search,
  Sparkles,
  Cpu,
  Activity,
  MessageCircle,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Shield,
  Brain,
  Globe,
  Bot,
  Factory,
  Crown,
  Phone,
  Monitor,
  Code,
  MessageSquare,
  TrendingUp,
  Settings,
  Database,
  Sparkles,
  Cpu,
  Activity,
};

const navCategories = [
  {
    title: "الرئيسية",
    items: [
      { href: "/admin", label: "نظرة عامة", icon: "Home" },
      { href: "/admin/assistant", label: "المساعد الموحّد", icon: "Brain" },
      { href: "/admin/owner-dashboard", label: "لوحة المالك", icon: "Crown" },
    ],
  },
  {
    title: "العمل",
    items: [
      { href: "/admin/work", label: "مركز العمل", icon: "TrendingUp" },
      { href: "/admin/sales", label: "المبيعات", icon: "MessageSquare" },
      { href: "/admin/manufacturing", label: "التصنيع", icon: "Factory" },
    ],
  },
  {
    title: "الذكاء",
    items: [
      { href: "/admin/intelligence", label: "مركز الذكاء", icon: "Bot" },
      { href: "/admin/agents", label: "سجل الوكلاء", icon: "Cpu" },
    ],
  },
  {
    title: "النظام",
    items: [
      { href: "/admin/system", label: "مركز النظام", icon: "Settings" },
      { href: "/admin/settings", label: "الإعدادات", icon: "Database" },
    ],
  },
];

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNav = navCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  // Close sidebar on path change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex overflow-hidden font-outfit">
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 rounded-xl bg-[#C5A059] text-[#1a1a1a] shadow-lg active:scale-95 transition-all"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 right-0 z-[70]
          w-[300px] flex-shrink-0
          border-l border-white/10 bg-[#0C0C0C]
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-lg">
                <Crown className="w-5 h-5 text-[#1a1a1a]" />
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">AZENITH <span className="text-[#C5A059] text-xs">OS</span></span>
            </div>
            <button 
              className="lg:hidden p-2 text-white/40 hover:text-white"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#C5A059] transition-colors" />
            <input 
              type="text"
              placeholder="بحث في الوظائف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-2 pr-10 pl-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#C5A059]/50 focus:bg-white/[0.05] transition-all"
            />
          </div>
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar scrollbar-hide">
          {filteredNav.map((category) => (
            <div key={category.title} className="space-y-3">
              <h3 className="px-4 text-[10px] font-bold text-[#C5A059]/40 uppercase tracking-[0.25em]">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href + "/"));
                  const Icon = iconMap[item.icon] || Code;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300
                        ${isActive 
                          ? "bg-[#C5A059]/10 text-[#C5A059] border-r-2 border-[#C5A059] shadow-lg shadow-[#C5A059]/5" 
                          : "text-white/40 hover:bg-white/[0.03] hover:text-white/80"
                        }
                      `}
                    >
                      <Icon className={`w-4.5 h-4.5 transition-transform group-hover:scale-110 ${isActive ? "text-[#C5A059]" : "text-white/20 group-hover:text-white/60"}`} />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && (
                        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer with System Stats */}
        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#C5A059]" />
                <span className="text-[10px] text-white/60">نظام الأوركيسترا</span>
              </div>
              <span className="text-[10px] text-emerald-400">نشط</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#C5A059] w-[85%] rounded-full animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] text-white/20 text-center uppercase tracking-widest font-bold">
            Sovereign OS v2.1
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar p-0">
          {children}
        </div>
      </main>

      <Link
        href="/admin/assistant"
        className="fixed z-50 bottom-6 left-6 lg:left-8 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#C5A059] text-[#1a1a1a] shadow-lg shadow-[#C5A059]/30 hover:scale-105 transition-transform font-bold text-sm"
        title="المساعد الموحّد"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">المساعد</span>
      </Link>
    </div>
  );
}
