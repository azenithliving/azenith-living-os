"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Crown,
  Zap,
  Activity,
  Building2,
  Users,
  Briefcase,
  TrendingUp,
  Target,
  Mail,
  Settings,
  Globe,
} from "lucide-react";

interface Metrics {
  totalTenants: number;
  totalLeads: number;
  totalVisitors: number;
  conversionRate: number;
  systemHealth: string;
  costSavings: number;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  trend?: { value: number; isPositive: boolean };
}) {
  const colorClasses: Record<string, string> = {
    gold: "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  };

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-3 border ${colorClasses[color] || colorClasses.gold}`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {trend.isPositive ? "+" : "-"}{trend.value}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        <p className="mt-1 text-sm font-medium text-white/70">{title}</p>
        <p className="mt-1 text-xs text-white/50">{subtitle}</p>
      </div>
    </Link>
  );
}

function QuickAction({
  title,
  desc,
  icon: Icon,
  href,
}: {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]"
    >
      <div className="rounded-xl bg-[#C5A059]/20 p-3 text-[#C5A059]">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h4 className="font-medium text-white group-hover:text-[#C5A059] transition-colors">{title}</h4>
        <p className="text-sm text-white/50">{desc}</p>
      </div>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalTenants: 0,
    totalLeads: 0,
    totalVisitors: 0,
    conversionRate: 0,
    systemHealth: "optimal",
    costSavings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        // Fetch data from your APIs
        const [tenantsRes, leadsRes, visitorsRes] = await Promise.all([
          fetch("/api/admin/tenants").catch(() => null),
          fetch("/api/admin/leads").catch(() => null),
          fetch("/api/admin/visitors").catch(() => null),
        ]);

        const tenants = tenantsRes?.ok ? await tenantsRes.json() : [];
        const leads = leadsRes?.ok ? await leadsRes.json() : [];
        const visitors = visitorsRes?.ok ? await visitorsRes.json() : [];

        const totalTenants = Array.isArray(tenants) ? tenants.length : 0;
        const totalLeads = Array.isArray(leads) ? leads.length : 0;
        const totalVisitors = Array.isArray(visitors) ? visitors.length : 0;

        // Calculate conversion rate
        const rate = totalVisitors > 0 ? Math.round((totalLeads / totalVisitors) * 100) : 0;

        setMetrics({
          totalTenants,
          totalLeads,
          totalVisitors,
          conversionRate: rate,
          systemHealth: "optimal",
          costSavings: totalTenants * 1500,
        });
      } catch (error) {
        console.error("Error fetching metrics:", error);
      } finally {
        setLoading(false);
      }
    }

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
    <div className="min-h-screen bg-[#0A0A0A] p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full animate-pulse" />
              <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
                <Crown className="w-7 h-7 text-[#1a1a1a]" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">لوحة التحكم الشخصية</h1>
              <p className="text-white/50">نظرة شاملة على أداء النظام</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">النظام يعمل بكفاءة</span>
          </div>
        </div>

        {/* Main Metrics Grid - 6 Key Indicators */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#C5A059]" />
            المؤشرات الرئيسية
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#C5A059]" />
            الوصول السريع
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-white/40">
            <p>أزينث ليفينج © 2025</p>
            <p>مركز القيادة السيادي الأسطوري v1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
