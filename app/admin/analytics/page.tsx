"use client";

import { useEffect, useState } from "react";
import { AnalyticsMetrics } from "@/lib/analytics";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7days" | "30days" | "90days">("30days");

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      const data = await response.json();
      if (data.ok && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل التحليلات...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Analytics</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">التحليلات والإحصائيات</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod("7days")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                period === "7days"
                  ? "bg-brand-primary text-brand-accent"
                  : "border border-white/20 text-white/70 hover:border-brand-primary hover:text-brand-primary"
              }`}
            >
              7 أيام
            </button>
            <button
              onClick={() => setPeriod("30days")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                period === "30days"
                  ? "bg-brand-primary text-brand-accent"
                  : "border border-white/20 text-white/70 hover:border-brand-primary hover:text-brand-primary"
              }`}
            >
              30 يوم
            </button>
            <button
              onClick={() => setPeriod("90days")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                period === "90days"
                  ? "bg-brand-primary text-brand-accent"
                  : "border border-white/20 text-white/70 hover:border-brand-primary hover:text-brand-primary"
              }`}
            >
              90 يوم
            </button>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/50">إجمالي العملاء المحتملين</p>
            <p className="mt-3 text-4xl font-semibold text-white">{metrics?.totalLeads || 0}</p>
            <p className="mt-2 text-xs text-white/40">الزوار الفريدون: {metrics?.uniqueVisitors || 0}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/50">إجمالي الطلبات</p>
            <p className="mt-3 text-4xl font-semibold text-white">{metrics?.totalRequests || 0}</p>
            <p className="mt-2 text-xs text-white/40">معدل التحويل: {metrics?.conversionRate || 0}%</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/50">إجمالي الحجوزات</p>
            <p className="mt-3 text-4xl font-semibold text-white">{metrics?.totalBookings || 0}</p>
            <p className="mt-2 text-xs text-white/40">المقبولة: {metrics?.acceptedBookings || 0}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
            <p className="text-sm text-white/50">متوسط نتيجة العميل</p>
            <p className="mt-3 text-4xl font-semibold text-white">{metrics?.averageLeadScore || 0}</p>
            <p className="mt-2 text-xs text-white/40">نقرات واتساب: {metrics?.whatsappClicks || 0}</p>
          </div>
        </div>

        {/* Top Room Types */}
        {metrics?.topRoomTypes && metrics.topRoomTypes.length > 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white mb-6">أنواع الغرف الأكثر طلباً</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {metrics.topRoomTypes.map((item, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center">
                  <p className="text-lg font-semibold text-white">{item.count}</p>
                  <p className="mt-1 text-sm text-white/60">{item.type}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Styles */}
        {metrics?.topStyles && metrics.topStyles.length > 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white mb-6">الأساليب الأكثر شيوعاً</h2>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {metrics.topStyles.map((item, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center">
                  <p className="text-lg font-semibold text-white">{item.count}</p>
                  <p className="mt-1 text-sm text-white/60">{item.style}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Breakdown */}
        {metrics?.eventBreakdown && Object.keys(metrics.eventBreakdown).length > 0 && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white mb-6">توزيع الأحداث</h2>
            <div className="space-y-3">
              {Object.entries(metrics.eventBreakdown).map(([eventType, count]) => (
                <div key={eventType} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-white">{eventType}</p>
                  <p className="text-2xl font-semibold text-brand-primary">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}