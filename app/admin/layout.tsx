"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Home, Settings, Users, BarChart3, Briefcase } from "lucide-react";

const navItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/sales-manager", label: "مدير المبيعات 🤵", icon: Briefcase },
  { href: "/admin/chat", label: "المحادثات", icon: MessageSquare },
  { href: "/admin/war-room", label: "غرفة العمليات", icon: BarChart3 },
  { href: "/admin/architect", label: "المهندس المعماري", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Sidebar */}
      <aside className="w-64 border-l border-white/10 bg-[#0A0A0A] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-semibold text-[#C5A059]">AZENITH</h1>
          <p className="text-xs text-white/50 mt-1">لوحة التحكم</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
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
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
