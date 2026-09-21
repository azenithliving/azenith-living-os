import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { supabaseServer } from "@/lib/dal/unified-supabase";

export const dynamic = "force-dynamic";

type ManufacturingMetrics = {
  orders_in_production: number | null;
  orders_ready: number | null;
  pending_payments: number | null;
  low_stock_items: number | null;
  delayed_jobs: number | null;
  jobs_completed_today: number | null;
};

function dateAtStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    // Do not accept a caller-supplied company id for admin metrics.
    void request;
    const companyId = await resolveAdminCompanyId();
    const unavailable: ManufacturingMetrics = {
      orders_in_production: null,
      orders_ready: null,
      pending_payments: null,
      low_stock_items: null,
      delayed_jobs: null,
      jobs_completed_today: null,
    };

    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: unavailable,
        warnings: ["No company record is available for manufacturing metrics."],
      });
    }

    const [jobsResult, inventoryResult, ordersResult] = await Promise.all([
      supabaseServer
        .from("production_jobs")
        .select("status, scheduled_end, actual_end")
        .eq("company_id", companyId),
      supabaseServer
        .from("inventory_items")
        .select("current_quantity, min_stock_level")
        .eq("company_id", companyId)
        .eq("is_active", true),
      supabaseServer
        .from("sales_orders")
        .select("deposit_paid")
        .eq("company_id", companyId),
    ]);

    const now = new Date();
    const todayStart = dateAtStartOfToday();
    const jobs = Array.isArray(jobsResult.data) ? jobsResult.data : [];
    const inventoryItems = Array.isArray(inventoryResult.data) ? inventoryResult.data : [];
    const orders = Array.isArray(ordersResult.data) ? ordersResult.data : [];

    const data: ManufacturingMetrics = {
      orders_in_production: jobsResult.error
        ? null
        : jobs.filter((job) => job.status === "in_progress").length,
      orders_ready: jobsResult.error
        ? null
        : jobs.filter((job) => job.status === "completed" || job.status === "ready").length,
      pending_payments: ordersResult.error
        ? null
        : orders.filter((order) => order.deposit_paid !== true).length,
      low_stock_items: inventoryResult.error
        ? null
        : inventoryItems.filter(
          (item) => Number(item.current_quantity ?? 0) <= Number(item.min_stock_level ?? 0)
        ).length,
      delayed_jobs: jobsResult.error
        ? null
        : jobs.filter((job) => {
          const scheduledEnd = parseDate(job.scheduled_end);
          return scheduledEnd !== null
            && scheduledEnd < now
            && job.status !== "completed"
            && job.status !== "cancelled";
        }).length,
      jobs_completed_today: jobsResult.error
        ? null
        : jobs.filter((job) => {
          const completedAt = parseDate(job.actual_end);
          return job.status === "completed" && completedAt !== null && completedAt >= todayStart;
        }).length,
    };

    return NextResponse.json({
      success: true,
      data,
      warnings: [jobsResult.error, inventoryResult.error, ordersResult.error]
        .filter(Boolean)
        .map((error) => error?.message),
    });
  } catch (error) {
    console.error("Manufacturing metrics error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل مؤشرات التصنيع." },
      { status: 500 }
    );
  }
}
