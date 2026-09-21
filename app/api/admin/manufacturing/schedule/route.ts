/**
 * Production schedule API. It exposes the dates recorded on production jobs;
 * unscheduled jobs remain explicitly unscheduled rather than receiving a
 * fabricated one-day slot.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { supabaseServer } from "@/lib/dal/unified-supabase";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stageFrom(value: unknown) {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
}

function progressFor(job: JsonRecord): number | null {
  const status = typeof job.status === "string" ? job.status : "";
  if (status === "completed") return 100;
  if (status === "cancelled" || status === "pending" || status === "scheduled") return 0;

  const start = asDate(job.actual_start) ?? asDate(job.scheduled_start);
  const end = asDate(job.scheduled_end);
  if (status !== "in_progress" || !start || !end || end <= start) return null;

  const elapsed = (Date.now() - start.getTime()) / (end.getTime() - start.getTime());
  return Math.max(0, Math.min(99, Math.round(elapsed * 100)));
}

export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const companyId = await resolveAdminCompanyId();
    const salesOrderId = searchParams.get("sales_order_id");
    const requestedStart = asDate(searchParams.get("start_date"));
    const requestedEnd = asDate(searchParams.get("end_date"));
    const view = searchParams.get("view") || "week";

    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: {
          schedule: [], stages: [],
          date_range: { start: null, end: null, view },
          summary: { total_jobs: 0, in_progress: 0, completed: 0, delayed: 0 },
        },
        warnings: ["No company record is available for production schedule."],
      });
    }

    let jobsQuery = supabaseServer
      .from("production_jobs")
      .select("id, sales_order_id, current_stage_id, status, scheduled_start, scheduled_end, actual_start, actual_end, priority, created_at, production_stages(name, color_code), sales_orders(customer_name)")
      .eq("company_id", companyId)
      .order("scheduled_start", { ascending: true, nullsFirst: false });

    if (salesOrderId) jobsQuery = jobsQuery.eq("sales_order_id", salesOrderId);
    const { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError) throw jobsError;

    const now = new Date();
    const schedule = (Array.isArray(jobs) ? jobs : [])
      .map((rawJob) => {
        const job = asRecord(rawJob) ?? {};
        const stage = stageFrom(job.production_stages);
        const order = stageFrom(job.sales_orders);
        const start = asDate(job.scheduled_start) ?? asDate(job.actual_start);
        const end = asDate(job.scheduled_end) ?? asDate(job.actual_end);
        const id = typeof job.id === "string" ? job.id : "";
        return {
          id,
          name: id ? `مهمة إنتاج #${id.slice(0, 8)}` : "مهمة إنتاج",
          customer: typeof order?.customer_name === "string" && order.customer_name
            ? order.customer_name
            : "غير مسمى",
          stage: typeof stage?.name === "string" && stage.name ? stage.name : "غير محددة",
          stage_color: typeof stage?.color_code === "string" ? stage.color_code : null,
          start: start?.toISOString() ?? null,
          end: end?.toISOString() ?? null,
          progress: progressFor(job),
          status: typeof job.status === "string" ? job.status : "pending",
          priority: typeof job.priority === "number" ? job.priority : 0,
          assigned_to: null,
          dependencies: [],
          order_id: typeof job.sales_order_id === "string" ? job.sales_order_id : null,
        };
      })
      .filter((job) => {
        if (!requestedStart && !requestedEnd) return true;
        if (!job.start || !job.end) return false;
        const start = new Date(job.start);
        const end = new Date(job.end);
        return (!requestedStart || end >= requestedStart) && (!requestedEnd || start <= requestedEnd);
      });

    const { data: stages, error: stagesError } = await supabaseServer
      .from("production_stages")
      .select("id, name, color_code, sequence_order, order_index")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("sequence_order", { ascending: true });

    if (stagesError) throw stagesError;

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        stages: Array.isArray(stages) ? stages : [],
        date_range: {
          start: requestedStart?.toISOString() ?? null,
          end: requestedEnd?.toISOString() ?? null,
          view,
        },
        summary: {
          total_jobs: schedule.length,
          in_progress: schedule.filter((job) => job.status === "in_progress").length,
          completed: schedule.filter((job) => job.status === "completed").length,
          delayed: schedule.filter((job) => {
            return job.end !== null
              && new Date(job.end) < now
              && job.status !== "completed"
              && job.status !== "cancelled";
          }).length,
        },
      },
    });
  } catch (error) {
    console.error("Schedule GET error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل جدول الإنتاج." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const companyId = await resolveAdminCompanyId();
    const productionJobId = typeof body.production_job_id === "string" ? body.production_job_id : null;
    const stageId = typeof body.stage_id === "string" && body.stage_id ? body.stage_id : null;
    const scheduledStart = asDate(body.scheduled_start);
    const scheduledEnd = asDate(body.scheduled_end);
    const resourceId = typeof body.resource_id === "string" && body.resource_id ? body.resource_id : null;
    const resourceName = typeof body.resource_name === "string" && body.resource_name.trim()
      ? body.resource_name.trim()
      : null;

    if (!companyId || !productionJobId || !scheduledStart || !scheduledEnd || scheduledEnd <= scheduledStart) {
      return NextResponse.json(
        { success: false, error: "حدد مهمة وتاريخ بداية ونهاية صحيحين." },
        { status: 400 }
      );
    }

    const { data: job, error: jobError } = await supabaseServer
      .from("production_jobs")
      .select("id")
      .eq("id", productionJobId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return NextResponse.json({ success: false, error: "مهمة الإنتاج غير موجودة." }, { status: 404 });

    if (stageId) {
      const { data: stage, error: stageError } = await supabaseServer
        .from("production_stages")
        .select("id")
        .eq("id", stageId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (stageError) throw stageError;
      if (!stage) return NextResponse.json({ success: false, error: "مرحلة الإنتاج غير موجودة." }, { status: 404 });
    }

    if (resourceId) {
      const { data: matchingEntries, error: conflictError } = await supabaseServer
        .from("production_schedule_entries")
        .select("id, production_job_id")
        .eq("resource_id", resourceId)
        .lt("scheduled_start", scheduledEnd.toISOString())
        .gt("scheduled_end", scheduledStart.toISOString())
        .neq("production_job_id", productionJobId);
      if (conflictError) throw conflictError;

      const conflictingJobIds = (Array.isArray(matchingEntries) ? matchingEntries : [])
        .map((entry) => entry.production_job_id)
        .filter((id): id is string => typeof id === "string");
      if (conflictingJobIds.length > 0) {
        const { data: conflictingJobs, error: conflictingJobsError } = await supabaseServer
          .from("production_jobs")
          .select("id")
          .eq("company_id", companyId)
          .in("id", conflictingJobIds);
        if (conflictingJobsError) throw conflictingJobsError;
        if (Array.isArray(conflictingJobs) && conflictingJobs.length > 0) {
          return NextResponse.json(
            { success: false, error: "المورد المحدد محجوز في هذه الفترة." },
            { status: 409 }
          );
        }
      }
    }

    let existingQuery = supabaseServer
      .from("production_schedule_entries")
      .select("id")
      .eq("production_job_id", productionJobId);
    existingQuery = stageId ? existingQuery.eq("stage_id", stageId) : existingQuery.is("stage_id", null);
    const { data: existingEntry, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw existingError;

    const entryData = {
      production_job_id: productionJobId,
      stage_id: stageId,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      resource_id: resourceId,
      resource_name: resourceName,
      updated_at: new Date().toISOString(),
    };

    const result = existingEntry
      ? await supabaseServer.from("production_schedule_entries").update(entryData).eq("id", existingEntry.id).select("*").single()
      : await supabaseServer.from("production_schedule_entries").insert(entryData).select("*").single();
    if (result.error) throw result.error;

    const jobUpdate: JsonRecord = {
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (stageId) jobUpdate.current_stage_id = stageId;
    const { error: updateJobError } = await supabaseServer
      .from("production_jobs")
      .update(jobUpdate)
      .eq("id", productionJobId)
      .eq("company_id", companyId);
    if (updateJobError) throw updateJobError;

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error("Schedule POST error:", error);
    return NextResponse.json(
      { success: false, error: "تعذر حفظ الجدولة." },
      { status: 500 }
    );
  }
}
