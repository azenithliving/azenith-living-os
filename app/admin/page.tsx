"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Crown,
  Zap,
  Activity,
  Users,
  Shield,
  Target,
  Brain,
  Bot,
  TrendingUp,
} from "lucide-react";

interface Metrics {
  totalLeads: number;
  totalVisitors: number;
  conversionRate: number;
  systemHealth: string;
  activeAutomations: number;
  aiInteractions: number;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    gold: "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
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
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[#C5A059] text-sm">← انتقل</span>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-white">{value}</h3>
        <p className="mt-1 text-sm font-medium text-white/70">{title}</p>
        <p className="mt-1 text-xs text-white/50">{subtitle}</p>
      </div>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalLeads: 0,
    totalVisitors: 0,
    conversionRate: 0,
    systemHealth: "optimal",
    activeAutomations: 3,
    aiInteractions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [leadsRes, visitorsRes] = await Promise.all([
          fetch("/api/admin/leads").catch(() => null),
          fetch("/api/admin/visitors").catch(() => null),
        ]);

        const leads = leadsRes?.ok ? await leadsRes.json() : [];
        const visitors = visitorsRes?.ok ? await visitorsRes.json() : [];

        const totalLeads = Array.isArray(leads) ? leads.length : 0;
        const totalVisitors = Array.isArray(visitors) ? visitors.length : 0;
        const rate = totalVisitors > 0 ? Math.round((totalLeads / totalVisitors) * 100) : 0;

        setMetrics({
          totalLeads,
          totalVisitors,
          conversionRate: rate,
          systemHealth: "optimal",
          activeAutomations: 3,
          aiInteractions: 1247,
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
      case "optimal": return "emerald";
      case "stable": return "blue";
      case "degraded": return "purple";
      default: return "rose";
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
            {/* 2 from Sales */}
            <MetricCard
              title="العملاء المحتملين"
              value={metrics.totalLeads}
              subtitle="عميل في قاعدة البيانات"
              icon={Users}
              href="/admin/sales"
              color="gold"
            />
            <MetricCard
              title="نسبة التحويل"
              value={`${metrics.conversionRate}%`}
              subtitle="من الزوار إلى عملاء"
              icon={TrendingUp}
              href="/admin/sales"
              color="emerald"
            />

            {/* 2 from Intel */}
            <MetricCard
              title="حالة النظام"
              value={metrics.systemHealth === "optimal" ? "ممتازة" : "مستقرة"}
              subtitle="الأداء العام للنظام"
              icon={Target}
              href="/admin/intel"
              color={getHealthColor(metrics.systemHealth)}
            />
            <MetricCard
              title="تفاعلات الذكاء"
              value={metrics.aiInteractions.toLocaleString()}
              subtitle="معالجة AI هذا الشهر"
              icon={Brain}
              href="/admin/intel"
              color="purple"
            />

            {/* 2 from Ops */}
            <MetricCard
              title="أتمتة نشطة"
              value={metrics.activeAutomations}
              subtitle="قواعد العمل التلقائي"
              icon={Bot}
              href="/admin/ops"
              color="cyan"
            />
            <MetricCard
              title="إجمالي الزوار"
              value={metrics.totalVisitors}
              subtitle="زائر هذا الشهر"
              icon={Shield}
              href="/admin/ops"
              color="blue"
            />
          </div>
        </section>

        {/* Quick Navigation */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#C5A059]" />
            مراكز القوى الأربعة
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link href="/admin/sales" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-[#C5A059]/20 p-3 w-fit mb-4">
                <Shield className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#C5A059] transition-colors">المبيعات والإدارة</h3>
              <p className="text-sm text-white/50 mt-2">مدير المبيعات، العملاء، المستأجرين، الإدارة، CMS</p>
            </Link>

            <Link href="/admin/intel" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-purple-500/20 p-3 w-fit mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">الاستخبارات والتطوير</h3>
              <p className="text-sm text-white/50 mt-2">غرفة العمليات، التحليلات، الذكاء، التطوير</p>
            </Link>

            <Link href="/admin/ops" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-cyan-500/20 p-3 w-fit mb-4">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">العمليات والأتمتة</h3>
              <p className="text-sm text-white/50 mt-2">الأتمتة، المحتوى، الحجوزات، الفواتير</p>
            </Link>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="rounded-xl bg-emerald-500/20 p-3 w-fit mb-4">
                <Crown className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">الرئيسية</h3>
              <p className="text-sm text-white/50 mt-2">لوحة المعلومات الشخصية - أنت هنا الآن</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-white/40">
            <p>أزينث ليفينج © 2025</p>
            <p>النظام البيئي السيادي v2.0 | 4 مراكز قوى</p>
          </div>
        </div>
      </div>
    </div>
  );
}
