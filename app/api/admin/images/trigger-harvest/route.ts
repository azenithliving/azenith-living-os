import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function getHarvestConfiguration() {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null;
  const repository = process.env.IMAGE_HARVEST_REPOSITORY?.trim() || null;
  const workflow = process.env.IMAGE_HARVEST_WORKFLOW?.trim() || null;
  const ref = process.env.IMAGE_HARVEST_REF?.trim() || "main";

  if (!token || !repository || !workflow) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return null;

  return { token, repository, workflow, ref };
}

/**
 * Starts a configured GitHub Actions harvester. No repository, target count,
 * or completion state is invented by this route: without explicit deployment
 * configuration it reports that the feature is unavailable.
 */
export async function POST() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const config = getHarvestConfiguration();
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        error: "لم تُهيأ خدمة حصاد الصور. اضبط IMAGE_HARVEST_REPOSITORY وIMAGE_HARVEST_WORKFLOW ومفتاح GitHub أولًا.",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${config.repository}/actions/workflows/${encodeURIComponent(config.workflow)}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "Azenith-Living",
        },
        body: JSON.stringify({ ref: config.ref }),
      }
    );

    if (!response.ok) {
      console.error("[Image harvest] GitHub dispatch failed:", response.status);
      return NextResponse.json(
        { success: false, error: `فشل تشغيل سير العمل على GitHub (HTTP ${response.status}).` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "تم قبول طلب التشغيل من GitHub. راقب سجل الحصاد لتأكيد النتيجة.",
        repository: config.repository,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Image harvest] Dispatch request failed:", error);
    return NextResponse.json(
      { success: false, error: "تعذر الاتصال بخدمة تشغيل الحصاد." },
      { status: 502 }
    );
  }
}

/** Returns actual library count; a workflow queue cannot be inferred safely. */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "قاعدة البيانات غير مهيأة." }, { status: 503 });
  }

  const { count, error } = await supabase
    .from("curated_images")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ success: false, error: "تعذر قراءة حالة مكتبة الصور." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    status: { currentCount: count ?? 0, workflowConfigured: Boolean(getHarvestConfiguration()) },
  });
}
