"use client";

import Link from "next/link";
import { Crown, Zap, Shield, Brain, Bot, TrendingUp, Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { MetricCard, ActivityFeed } from "@/components/admin/master-dashboard-components";

export default function AdminPage() {
  // Mock data for metrics
  const metrics = [
    { title: "العملاء المحتملين", value: 24, subtitle: "عميل نشط", icon: <Users className="h-6 w-6" />, color: "gold" as const, href: "/admin/sales" },
    { title: "نسبة التحويل", value: "12.5%", subtitle: "زيادة 3%", icon: <TrendingUp className="h-6 w-6" />, color: "green" as const, trend: { value: 3, isPositive: true }, href: "/admin/sales" },
    { title: "حالة النظام", value: "ممتازة", subtitle: "99.9% uptime", icon: <Shield className="h-6 w-6" />, color: "blue" as const, href: "/admin/intel" },
    { title: "تفاعلات AI", value: 1247, subtitle: "هذا الشهر", icon: <Brain className="h-6 w-6" />, color: "purple" as const, href: "/admin/intel" },
    { title: "أتمتة نشطة", value: 3, subtitle: "قواعد العمل", icon: <Bot className="h-6 w-6" />, color: "blue" as const, href: "/admin/ops" },
    { title: "الزوار", value: 186, subtitle: "هذا الشهر", icon: <Clock className="h-6 w-6" />, color: "gold" as const, href: "/admin/ops" },
  ];

  // Mock activities
  const activities = [
    { id: "1", type: "lead" as const, tenantName: "شركة الأفق", description: "عميل جديد مسجل في النظام", timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
    { id: "2", type: "booking" as const, tenantName: "فيلا النخيل", description: "حجز جديد مؤكد", timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
    { id: "3", type: "request" as const, tenantName: "برج المستقبل", description: "طلب عرض سعر جديد", timestamp: new Date(Date.now() - 30 * 60000).toISOString() },
    { id: "4", type: "subscriber" as const, tenantName: "النشرة البريدية", description: "مشترك جديد", timestamp: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: "5", type: "lead" as const, tenantName: "قصر الواحة", description: "عميل محتمل جديد", timestamp: new Date(Date.now() - 120 * 60000).toISOString() },
  ];

  // Mock alerts
  const alerts = [
    { icon: AlertTriangle, color: "rose", text: "3 عملاء محتملين بحاجة للمتابعة", subtext: "تأخير الرد أكثر من 24 ساعة", link: "/admin/sales" },
    { icon: Zap, color: "amber", text: "استخدام API مرتفع", subtext: "85% من الحصة اليومية مستخدمة", link: "/admin/intel" },
    { icon: CheckCircle, color: "emerald", text: "النسخ الاحتياطي مكتمل", subtext: "تم بنجاح الساعة 3:00 صباحاً", link: "/admin/ops" },
  ];

  const colorClasses: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/10",
    amber: "border-amber-500/30 bg-amber-500/10",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
  };

  const iconColors: Record<string, string> = {
    rose: "text-rose-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  };

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
              <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
              <p className="text-white/50">نظرة شاملة على أداء النظام</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-400">النظام يعمل بكفاءة</span>
          </div>
        </div>

        {/* 6 Metric Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#C5A059]" />
            المؤشرات الرئيسية
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric, idx) => (
              <Link key={idx} href={metric.href} className="block">
                <MetricCard
                  title={metric.title}
                  value={metric.value}
                  subtitle={metric.subtitle}
                  icon={metric.icon}
                  color={metric.color}
                  trend={metric.trend}
                />
              </Link>
            ))}
          </div>
        </section>

        {/* Activities & Alerts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activities */}
          <ActivityFeed activities={activities} />

          {/* Top Alerts */}
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              أهم التنبيهات
            </h2>
            <p className="mt-1 text-sm text-white/60">تنبيهات تتطلب الانتباه</p>

            <div className="mt-6 space-y-4">
              {alerts.map((alert, idx) => (
                <Link
                  key={idx}
                  href={alert.link}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${colorClasses[alert.color]} hover:opacity-80 transition-all`}
                >
                  <div className="rounded-lg bg-black/20 p-2">
                    <alert.icon className={`w-5 h-5 ${iconColors[alert.color]}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{alert.text}</p>
                    <p className="text-xs text-white/60 mt-1">{alert.subtext}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">مراكز القوى</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/admin/sales" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-[#C5A059]/20 p-3 w-fit mb-4">
                <Shield className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#C5A059] transition-colors">المبيعات</h3>
              <p className="text-sm text-white/50 mt-2">العملاء، المستأجرين، الإدارة</p>
            </Link>

            <Link href="/admin/intel" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-purple-500/20 p-3 w-fit mb-4">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">الاستخبارات</h3>
              <p className="text-sm text-white/50 mt-2">التحليلات، الذكاء، التطوير</p>
            </Link>

            <Link href="/admin/ops" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-cyan-500/20 p-3 w-fit mb-4">
                <Bot className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">العمليات</h3>
              <p className="text-sm text-white/50 mt-2">الأتمتة، المحتوى، الحجوزات</p>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-white/40">
            <p>أزينث ليفينج © 2025</p>
            <p>النظام البيئي السيادي v2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
