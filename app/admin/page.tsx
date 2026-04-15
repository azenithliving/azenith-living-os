"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Mail,
  Target,
  TrendingUp,
  Activity,
  Crown,
  Briefcase,
  Globe,
  Settings,
  ArrowLeft,
  Zap,
} from "lucide-react";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                    لوحة المعلومات الشخصية - Personal Dashboard              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

interface DashboardMetrics {
  // MasterControlCenter (2 metrics)
  totalTenants: number;
  totalLeads: number;
  // SalesManager (2 metrics)
  totalVisitors: number;
  conversionRate: number;
  // WarRoom (2 metrics)
  systemHealth: string;
  costSavings: number;
}

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  color = "gold",
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  href: string;
  color?: "gold" | "blue" | "emerald" | "purple" | "rose";
  trend?: { value: number; isPositive: boolean };
}) => {
  const colorClasses = {
    gold: "from-[#C5A059]/20 to-[#C5A059]/5 border-[#C5A059]/30 hover:border-[#C5A059]/60",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 hover:border-blue-500/60",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/60",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 hover:border-purple-500/60",
    rose: "from-rose-500/20 to-rose-500/5 border-rose-500/30 hover:border-rose-500/60",
  };

  return (
    <Link href={href} className="block group min-h-[44px]">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 md:p-6 transition-all duration-300",
          colorClasses[color]
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-white/50">{title}</p>
            <p className="mt-2 text-2xl md:text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-white/60">{subtitle}</p>}
            {trend && (
              <div
                className={cn(
                  "mt-2 flex items-center gap-1 text-xs",
                  trend.isPositive ? "text-emerald-400" : "text-rose-400"
                )}
              >
                <TrendingUp className={cn("w-3 h-3", !trend.isPositive && "rotate-180")} />
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className="rounded-xl bg-white/10 p-2 md:p-3 transition-colors group-hover:bg-white/20 flex-shrink-0">
            <Icon className="h-5 w-5 md:h-6 md:w-6 text-white/80" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1 text-xs text-white/40 group-hover:text-white/60 transition-colors">
          <span>عرض التفاصيل</span>
          <ArrowLeft className="w-3 h-3 transform rotate-180 group-hover:-translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
};

const QuickAction = ({
  title,
  desc,
  icon: Icon,
  href,
}: {
  title: string;
  desc: string;
  icon: React.ElementType;
  href: string;
}) => (
  <Link
    href={href}
    className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border border-white/10 bg-white/5 hover:border-[#C5A059]/30 hover:bg-white/10 transition-all group min-h-[44px]"
  >
    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-[#C5A059]/10 text-[#C5A059] group-hover:bg-[#C5A059]/20 transition-colors flex-shrink-0">
      <Icon className="h-5 w-5 md:h-6 md:w-6" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-white text-sm md:text-base">{title}</h3>
      <p className="text-xs md:text-sm text-white/50">{desc}</p>
    </div>
    <ArrowLeft className="w-5 h-5 text-white/30 group-hover:text-[#C5A059] transform rotate-180 transition-all flex-shrink-0" />
  </Link>
);

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalTenants: 0,
    totalLeads: 0,
    totalVisitors: 0,
    conversionRate: 0,
    systemHealth: "optimal",
    costSavings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch metrics from various sources
    const fetchMetrics = async () => {
      try {
        // Fetch Master Dashboard data
        const masterResponse = await fetch("/api/admin/dashboard");
        if (masterResponse.ok) {
          const masterData = await masterResponse.json();
          setMetrics((prev) => ({
            ...prev,
            totalTenants: masterData.totalTenants || 0,
            totalLeads: masterData.totalLeads || 0,
          }));
        }

        // Fetch War Room data
        const warRoomResponse = await fetch("/api/admin/war-room");
        if (warRoomResponse.ok) {
          const warRoomData = await warRoomResponse.json();
          setMetrics((prev) => ({
            ...prev,
            systemHealth: warRoomData.data?.defense?.systemHealth || "optimal",
            costSavings: warRoomData.data?.cache?.costSavings || 0,
          }));
        }

        // Fetch Sales data
        const salesResponse = await fetch("/api/sales-leader/visitors");
        if (salesResponse.ok) {
          const salesData = await salesResponse.json();
          const visitors = salesData.visitors || [];
          const converted = visitors.filter((v: any) => v.conversion_stage === "converted").length;
          const rate = visitors.length > 0 ? Math.round((converted / visitors.length) * 100) : 0;
          setMetrics((prev) => ({
            ...prev,
            totalVisitors: visitors.length,
            conversionRate: rate,
          }));
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const getHealthColor = (health: string) => {
    switch (health) {
      case "optimal":
        return "emerald";
      case "stable":
        return "blue";
      case "degraded":
        return "purple";
      default:
        return "rose";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#C5A059] mx-auto" />
          <p className="mt-4 text-white/50">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 md:px-6 lg:px-8 py-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full animate-pulse" />
              <div className="relative p-2 md:p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
                <Crown className="w-6 h-6 md:w-7 md:h-7 text-[#1a1a1a]" />
              </div>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">لوحة التحكم الشخصية</h1>
              <p className="text-sm text-white/50">نظرة شاملة على أداء النظام</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 min-h-[44px]">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">النظام يعمل بكفاءة</span>
          </div>
        </div>

        {/* Main Metrics Grid - 6 Key Indicators */}
        <section>
          <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 md:w-5 md:h-5 text-[#C5A059]" />
            المؤشرات الرئيسية
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* MasterControlCenter Metrics (2) */}
            <MetricCard
              title="إجمالي الشركات"
              value={metrics.totalTenants}
              subtitle="شركة مسجلة في النظام"
              icon={Building2}
              href="/admin/chat"
              color="gold"
              trend={{ value: 12, isPositive: true }}
            />
            <MetricCard
              title="العملاء النشطين"
              value={metrics.totalLeads}
              subtitle="عميل في قاعدة البيانات"
              icon={Users}
              href="/admin/chat"
              color="blue"
              trend={{ value: 8, isPositive: true }}
            />

            {/* SalesManager Metrics (2) */}
            <MetricCard
              title="إجمالي الزوار"
              value={metrics.totalVisitors}
              subtitle="زائر هذا الشهر"
              icon={Briefcase}
              href="/admin/sales-manager"
              color="purple"
              trend={{ value: 15, isPositive: true }}
            />
            <MetricCard
              title="نسبة التحويل"
              value={`${metrics.conversionRate}%`}
              subtitle="من الزوار إلى عملاء"
              icon={TrendingUp}
              href="/admin/sales-manager"
              color="emerald"
              trend={{ value: 5, isPositive: true }}
            />

            {/* WarRoom Metrics (2) */}
            <MetricCard
              title="حالة النظام"
              value={
                metrics.systemHealth === "optimal"
                  ? "ممتازة"
                  : metrics.systemHealth === "stable"
                  ? "مستقرة"
                  : "تحت المراقبة"
              }
              subtitle="الأداء العام للنظام"
              icon={Target}
              href="/admin/war-room"
              color={getHealthColor(metrics.systemHealth)}
            />
            <MetricCard
              title="التوفير المالي"
              value={`$${metrics.costSavings.toLocaleString()}`}
              subtitle="بفضل التحسينات"
              icon={Mail}
              href="/admin/war-room"
              color="gold"
              trend={{ value: 23, isPositive: true }}
            />
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 md:w-5 md:h-5 text-[#C5A059]" />
            الوصول السريع
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              title="مركز القيادة"
              desc="التحكم الكامل في النظام"
              icon={Crown}
              href="/admin/chat"
            />
            <QuickAction
              title="مدير المبيعات"
              desc="إدارة العملاء والتحويلات"
              icon={Briefcase}
              href="/admin/sales-manager"
            />
            <QuickAction
              title="مدير الموقع"
              desc="تحسين الموقع وSEO"
              icon={Globe}
              href="/admin/site-manager"
            />
            <QuickAction
              title="غرفة العمليات"
              desc="مراقبة الأداء والذكاء"
              icon={Target}
              href="/admin/war-room"
            />
            <QuickAction
              title="المهندس المعماري"
              desc="الإعدادات والتكوينات"
              icon={Settings}
              href="/admin/architect"
            />
          </div>
        </section>

        {/* Footer */}
        <div className="pt-6 md:pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs md:text-sm text-white/40">
            <p>أزينث ليفينج © 2025</p>
            <p>مركز القيادة السيادي الأسطوري v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

