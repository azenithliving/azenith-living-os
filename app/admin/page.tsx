"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Zap, Shield, Brain, Bot, TrendingUp, Users, Clock, AlertTriangle, CheckCircle, Loader2, Image, MessageSquare, Activity, Factory } from "lucide-react";
import { MetricCard, ActivityFeed } from "@/components/admin/master-dashboard-components";
import { ImageHarvestDashboard } from "./intel/components/ImageHarvestDashboard";
import { AdminProactiveStrip } from "@/components/admin/AdminProactiveStrip";

interface AnalyticsData {
  metrics: {
    totalLeads: number;
    conversionRate: number;
    totalRequests: number;
    totalBookings: number;
    whatsappClicks: number;
    uniqueVisitors: number;
    averageLeadScore: number;
  };
}

interface SystemHealthData {
  health: {
    status: string;
    uptime: string;
    memoryUsage: number;
    cpuUsage: number;
  };
  pendingAlerts: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
  }>;
}

interface MastermindStatsData {
  commands: {
    total: number;
    successful: number;
    failed: number;
    last24h: number;
  };
  security: {
    failedAttempts24h: number;
    has2FA: boolean;
  };
  recentCommands: Array<{
    id: string;
    command: string;
    status: string;
    executedAt: string;
  }>;
}

export default function AdminPage() {
  // Real data states
  const [metrics, setMetrics] = useState<Array<{
    title: string;
    value: number | string;
    subtitle: string;
    icon: React.ReactNode;
    color: "gold" | "blue" | "green" | "purple";
    trend?: { value: number; isPositive: boolean };
    href: string;
  }> | null>(null);

  const [activities, setActivities] = useState<Array<{
    id: string;
    type: "lead" | "booking" | "request" | "subscriber";
    tenantName: string;
    description: string;
    timestamp: string;
  }> | null>(null);

  const [alerts, setAlerts] = useState<Array<{
    icon: React.ElementType;
    color: "rose" | "amber" | "emerald";
    text: string;
    subtext: string;
    link: string;
  }> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<{
    whatsapp: string;
    aaca: string;
    aacaMode?: string;
    aacaLabel?: string;
  }>({
    whatsapp: "loading",
    aaca: "loading",
  });

  // Fetch real data from APIs
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all APIs in parallel
        const [analyticsRes, healthRes, mastermindRes] = await Promise.all([
          fetch("/api/analytics?period=30days"),
          fetch("/api/system-health"),
          fetch("/api/admin/mastermind/stats"),
        ]);

        const analytics: AnalyticsData = analyticsRes.ok ? await analyticsRes.json() : { metrics: {} };
        const health: SystemHealthData = healthRes.ok ? await healthRes.json() : { health: {}, pendingAlerts: [] };
        const mastermind: MastermindStatsData = mastermindRes.ok ? await mastermindRes.json() : { commands: {}, security: {}, recentCommands: [] };

        // Map real data to metrics
        const realMetrics = [
          {
            title: "العملاء المحتملين",
            value: analytics.metrics?.totalLeads || 0,
            subtitle: analytics.metrics?.totalLeads ? "عميل نشط" : "لا توجد بيانات",
            icon: <Users className="h-6 w-6" />,
            color: "gold" as const,
            href: "/admin/sales",
          },
          {
            title: "نسبة التحويل",
            value: (analytics.metrics?.conversionRate || 0) + "%",
            subtitle: "معدل التحويل الإجمالي",
            icon: <TrendingUp className="h-6 w-6" />,
            color: "green" as const,
            trend: {
              value: Math.round(analytics.metrics?.conversionRate || 0),
              isPositive: (analytics.metrics?.conversionRate || 0) > 5,
            },
            href: "/admin/sales",
          },
          {
            title: "حالة النظام",
            value: health.health?.status === "optimal" ? "ممتازة" : health.health?.status === "stable" ? "مستقرة" : "غير معروفة",
            subtitle: health.health?.uptime ? `${health.health.uptime} uptime` : "غير متاح",
            icon: <Shield className="h-6 w-6" />,
            color: health.health?.status === "optimal" ? "blue" : "blue" as const,
            href: "/admin/intel",
          },
          {
            title: "تفاعلات AI",
            value: mastermind.commands?.total || 0,
            subtitle: mastermind.commands?.last24h ? `${mastermind.commands.last24h} في آخر 24 ساعة` : "هذا الشهر",
            icon: <Brain className="h-6 w-6" />,
            color: "purple" as const,
            href: "/admin/intel",
          },
          {
            title: "نظام الوكلاء",
            value: analytics.metrics?.totalRequests || 0,
            subtitle: analytics.metrics?.totalBookings ? `${analytics.metrics.totalBookings} حجز مؤكد` : "قيد الانتظار",
            icon: <Bot className="h-6 w-6" />,
            color: "blue" as const,
            href: "/admin/agents",
          },
          {
            title: "نشاط المنصة",
            value: analytics.metrics?.uniqueVisitors || 0,
            subtitle: analytics.metrics?.whatsappClicks ? `${analytics.metrics.whatsappClicks} نقر واتساب` : "هذا الشهر",
            icon: <Clock className="h-6 w-6" />,
            color: "gold" as const,
            href: "/admin",
          },
        ];

        setMetrics(realMetrics);

        // Generate activities from recent commands or fallback to empty
        const realActivities = mastermind.recentCommands?.slice(0, 5).map((cmd, index) => ({
          id: cmd.id || `cmd-${index}`,
          type: (cmd.status === "executed" ? "booking" : cmd.status === "failed" ? "request" : "lead") as "lead" | "booking" | "request" | "subscriber",
          tenantName: cmd.command?.split(" ")[0] || "نظام",
          description: cmd.command?.slice(0, 50) + (cmd.command?.length > 50 ? "..." : "") || "أمر تم تنفيذه",
          timestamp: cmd.executedAt || new Date().toISOString(),
        })) || [];

        setActivities(realActivities.length > 0 ? realActivities : []);

        // Generate alerts from system health
        const realAlerts = [];
        
        // Add security alert if there are failed attempts
        if (mastermind.security?.failedAttempts24h > 0) {
          realAlerts.push({
            icon: AlertTriangle,
            color: "rose" as const,
            text: `${mastermind.security.failedAttempts24h} محاولة دخول فاشلة`,
            subtext: "في آخر 24 ساعة - تحقق من الأمان",
            link: "/admin/intel",
          });
        }

        // Add system health alerts
        if (health.pendingAlerts && health.pendingAlerts.length > 0) {
          health.pendingAlerts.slice(0, 2).forEach((alert) => {
            realAlerts.push({
              icon: alert.severity === "critical" ? AlertTriangle : CheckCircle,
              color: alert.severity === "critical" ? "rose" : alert.severity === "warning" ? "amber" : "emerald" as const,
              text: alert.title,
              subtext: alert.description,
              link: "/admin/intel",
            });
          });
        }

        // Default alert if none exist
        if (realAlerts.length === 0) {
            realAlerts.push({
              icon: CheckCircle,
              color: "emerald" as const,
              text: "النظام يعمل بكفاءة",
              subtext: "لا توجد مشاكل أو تنبيهات حالية",
              link: "/admin",
            });
        }

        setAlerts(realAlerts);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("فشل في تحميل البيانات. يرجى تحديث الصفحة.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Fetch system health (WhatsApp & AACA)
    const checkSystems = async () => {
      try {
        const waRes = await fetch("/api/admin/whatsapp/status");
        const waData = await waRes.json();
        let aacaJson: { status?: string; mode?: string; label?: string } = {
          status: "OFFLINE",
          mode: "cloud",
        };
        try {
          const aacaRes = await fetch("/api/admin/aaca/status");
          if (aacaRes.ok) aacaJson = await aacaRes.json();
        } catch {
          /* keep offline fallback */
        }
        
        setSystemStatus({
          whatsapp: waData.status || "DISCONNECTED",
          aaca: aacaJson.status === "READY" ? "READY" : "OFFLINE",
          aacaMode: aacaJson.mode || "cloud",
          aacaLabel: aacaJson.label || "",
        });
      } catch (e) {
        setSystemStatus({ whatsapp: "ERROR", aaca: "ERROR" });
      }
    };
    checkSystems();
  }, []);

  const colorClasses: Record<string, string> = {
    rose: "border-rose-500/30 bg-rose-500/10",
    amber: "border-amber-500/30 bg-amber-500/10",
    emerald: "border-emerald-500/30 bg-emerald-500/10",
  };

  const [aiHealth, setAiHealth] = useState<any>(null);

  useEffect(() => {
    const fetchAIHealth = async () => {
      try {
        const res = await fetch("/api/admin/ai/health");
        if (res.ok) setAiHealth(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchAIHealth();
  }, []);

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

        <AdminProactiveStrip />

        {/* System Health Overview */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${systemStatus.whatsapp === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">خدمة الواتساب</h3>
                <p className="text-[10px] text-white/40">الحالة الحالية لمحرك التواصل</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full animate-pulse ${systemStatus.whatsapp === 'READY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className={`text-xs font-bold ${systemStatus.whatsapp === 'READY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {systemStatus.whatsapp === 'READY' ? 'متصل' : 'غير متصل'}
              </span>
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${systemStatus.aaca === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">نظام الوكلاء (7 وكلاء)</h3>
                <p className="text-[10px] text-white/40">
                  {systemStatus.aacaLabel || "يعمل من الموقع المنشور — بدون جهازك"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full animate-pulse ${systemStatus.aaca === 'READY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className={`text-xs font-bold ${systemStatus.aaca === 'READY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {systemStatus.aaca === 'READY' ? 'نشط' : 'متوقف'}
              </span>
            </div>
          </div>
        </section>

        {/* AI Key Pools Health */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              مراقبة أحواض الذكاء الاصطناعي
            </h2>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">تحديث مباشر</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {aiHealth && aiHealth.pools && Object.entries(aiHealth.pools).map(([name, pool]: [string, any]) => (
              <div key={name} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 transition-all hover:bg-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{name}</span>
                  <div className={`h-1.5 w-1.5 rounded-full ${pool.healthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{pool.keys}</span>
                  <span className="text-[10px] text-white/30">مفتاح</span>
                </div>
                <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pool.healthy ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`} style={{ width: pool.keys > 0 ? '100%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6 Metric Cards */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#C5A059]" />
            المؤشرات الرئيسية
          </h2>
          
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
              <span className="mr-3 text-white/60">جاري تحميل البيانات...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-rose-400">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-[#C5A059] text-[#1a1a1a] rounded-lg hover:bg-[#d8b56d]"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Metrics Grid */}
          {!loading && !error && metrics && (
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
          )}
        </section>

        {/* Activities & Alerts */}
        {!loading && !error && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recent Activities */}
            <ActivityFeed activities={activities || []} />

            {/* Top Alerts */}
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                أهم التنبيهات
              </h2>
              <p className="mt-1 text-sm text-white/60">تنبيهات تتطلب الانتباه</p>

              <div className="mt-6 space-y-4">
                {alerts && alerts.length > 0 ? (
                  alerts.map((alert, idx) => (
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
                  ))
                ) : (
                  <p className="text-center text-white/40 py-4">لا توجد تنبيهات حالية</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Navigation */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">مراكز القوى</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/admin/assistant" className="group rounded-2xl border-2 border-[#C5A059]/40 bg-[#C5A059]/10 p-6 transition-all hover:border-[#C5A059] hover:bg-[#C5A059]/15">
              <div className="rounded-xl bg-[#C5A059]/30 p-3 w-fit mb-4">
                <Brain className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="text-lg font-bold text-[#C5A059]">المساعد الموحّد</h3>
              <p className="text-sm text-white/60 mt-2">كل الذكاء والتنفيذ — مكان واحد</p>
            </Link>

            <Link href="/admin/sales" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-[#C5A059]/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-[#C5A059]/20 p-3 w-fit mb-4">
                <TrendingUp className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#C5A059] transition-colors">المبيعات</h3>
              <p className="text-sm text-white/50 mt-2">العملاء، المستأجرين، الإدارة</p>
            </Link>

            <Link href="/admin/agents" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-purple-500/20 p-3 w-fit mb-4">
                <Bot className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">الوكلاء</h3>
              <p className="text-sm text-white/50 mt-2">التحليلات، الذكاء، التطوير</p>
            </Link>

            <Link href="/admin/manufacturing" className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-cyan-500/30 hover:bg-white/[0.05]">
              <div className="rounded-xl bg-cyan-500/20 p-3 w-fit mb-4">
                <Factory className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">التصنيع</h3>
              <p className="text-sm text-white/50 mt-2">الأتمتة، الإنتاج، التوريد</p>
            </Link>
          </div>
        </section>

        {/* Image Harvest Dashboard */}
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
              <Image className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">نظام الصور الذكي</h2>
              <p className="text-sm text-white/60">15,000 صورة ذكية | تجديد شهري تلقائي</p>
            </div>
          </div>
          <ImageHarvestDashboard />
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
