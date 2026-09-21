"use client";

import { useCallback, useEffect, useState } from "react";
import { InventoryManager } from "./InventoryManager";
import { ProjectGantt } from "./ProjectGantt";

interface ManufacturingMetrics {
  orders_in_production: number | null;
  orders_ready: number | null;
  pending_payments: number | null;
  low_stock_items: number | null;
  delayed_jobs: number | null;
  jobs_completed_today: number | null;
}

function displayMetric(value: number | null) {
  return value === null ? "—" : value.toLocaleString("ar-EG");
}

export function ManufacturingDashboard() {
  const [metrics, setMetrics] = useState<ManufacturingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "inventory">("overview");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/manufacturing/metrics", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "تعذر تحميل مؤشرات التصنيع.");
      }
      setMetrics(data.data as ManufacturingMetrics);
      setWarnings(Array.isArray(data.warnings) ? data.warnings.filter((warning: unknown): warning is string => typeof warning === "string") : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر تحميل مؤشرات التصنيع.");
      setMetrics(null);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const MetricCard = ({ title, value, color, subtitle }: {
    title: string;
    value: number | null;
    color: string;
    subtitle: string;
  }) => (
    <div className={`p-4 rounded-lg border-2 ${color} transition-shadow hover:shadow-md`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-1 text-2xl font-bold">{displayMetric(value)}</p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );

  const delayedJobs = metrics?.delayed_jobs ?? null;
  const lowStockItems = metrics?.low_stock_items ?? null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p>{error}</p>
          <button type="button" onClick={() => void fetchMetrics()} className="mt-2 text-sm font-medium underline">إعادة المحاولة</button>
        </div>
      )}

      {warnings.map((warning) => (
        <p key={warning} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>
      ))}

      {metrics && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard title="في الإنتاج" value={metrics.orders_in_production} color="border-blue-200 bg-blue-50" subtitle="أوامر نشطة" />
          <MetricCard title="جاهز للتسليم" value={metrics.orders_ready} color="border-green-200 bg-green-50" subtitle="مكتمل أو جاهز" />
          <MetricCard title="مستحقات" value={metrics.pending_payments} color="border-yellow-200 bg-yellow-50" subtitle="دفعات لم تُسدّد" />
          <MetricCard title="مخزون منخفض" value={metrics.low_stock_items} color="border-red-200 bg-red-50" subtitle="يحتاج متابعة" />
          <MetricCard title="متأخر" value={metrics.delayed_jobs} color="border-orange-200 bg-orange-50" subtitle="تجاوز موعده" />
          <MetricCard title="تم اليوم" value={metrics.jobs_completed_today} color="border-purple-200 bg-purple-50" subtitle="بناءً على وقت الإكمال" />
        </div>
      )}

      <div className="flex gap-2 border-b">
        {(["overview", "schedule", "inventory"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab === "overview" && "نظرة عامة"}
            {tab === "schedule" && "الجدولة"}
            {tab === "inventory" && "المخزون"}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ProjectGantt />
            <section className="space-y-4">
              <h3 className="font-semibold">حالة المتابعة</h3>
              <div className="rounded-lg bg-purple-50 p-4">
                <p className="text-sm text-purple-800">
                  {delayedJobs === null
                    ? "لا تتوفر بيانات التأخير حاليًا."
                    : delayedJobs === 0
                      ? "لا توجد مهام متأخرة مسجلة حاليًا."
                      : `هناك ${delayedJobs} مهام متأخرة مسجلة؛ راجع الجدولة والمورد المخصّص لكل مهمة.`}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  {lowStockItems === null
                    ? "لا تتوفر بيانات المخزون حاليًا."
                    : lowStockItems === 0
                      ? "لا توجد أصناف منخفضة المخزون في البيانات الحالية."
                      : `يوجد ${lowStockItems} أصناف منخفضة المخزون. افتح تبويب المخزون لإنشاء أوامر شراء للمواد المكتملة البيانات.`}
                </p>
              </div>
            </section>
          </div>
        )}

        {activeTab === "schedule" && <ProjectGantt />}
        {activeTab === "inventory" && <InventoryManager />}
      </div>
    </div>
  );
}
