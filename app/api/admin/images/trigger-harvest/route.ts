import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

async function getHarvestConfiguration(explicitToken?: string | null): Promise<{ token: string; repository: string; workflow: string; ref: string } | null> {
  let token = explicitToken?.trim() || process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || null;

  if (!token) {
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { data: dbKey } = await supabase
          .from("api_keys")
          .select("key")
          .eq("provider", "github")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbKey?.key) {
          token = dbKey.key.trim();
        }
      }
    } catch (_) {
      // Continue with null
    }
  }

  const repository = process.env.IMAGE_HARVEST_REPOSITORY?.trim() || "azenithliving/azenith-living-os";
  const workflow = process.env.IMAGE_HARVEST_WORKFLOW?.trim() || "run-harvester.yml";
  const ref = process.env.IMAGE_HARVEST_REF?.trim() || "main";

  if (!token) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return null;

  return { token, repository, workflow, ref };
}

/**
 * Starts a configured GitHub Actions harvester. No repository, target count,
 * or completion state is invented by this route: without explicit deployment
 * configuration it reports that the feature is unavailable.
 */
export async function POST(request: Request) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let bodyToken: string | null = null;
  let saveToken = false;

  try {
    const body = await request.json();
    if (body && typeof body.token === "string" && body.token.trim()) {
      bodyToken = body.token.trim();
      saveToken = Boolean(body.saveToken);
    }
  } catch (_) {
    // Body is optional
  }

  const config = await getHarvestConfiguration(bodyToken);
  if (!config) {
    return NextResponse.json(
      {
        success: false,
        error: "لم يُهيأ مفتاح الوصول إلى GitHub (GITHUB_TOKEN). يرجى إدخال التوكن في النافذة المنبثقة أو ضبطه في لوحة المفاتيح لتشغيل خوادم الحصاد السحابية.",
        needsToken: true,
      },
      { status: 400 }
    );
  }

  // If user provided a new token and requested saving it, store it in api_keys table
  if (bodyToken && saveToken) {
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from("api_keys").insert({
          provider: "github",
          key: bodyToken,
          is_active: true,
          notes: "GitHub Actions Harvester Token",
        });
      }
    } catch (saveErr) {
      console.warn("[Image harvest] Failed to persist GitHub token to database:", saveErr);
    }
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
          "User-Agent": "Azenith-Living-OS",
        },
        body: JSON.stringify({ ref: config.ref }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("[Image harvest] GitHub dispatch failed:", response.status, errText);
      
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "مفتاح GitHub المرفق غير صالح أو تنقصه صلاحية workflow / repo. يرجى التأكد من صلاحيات التوكن.",
            needsToken: true,
          },
          { status: 401 }
        );
      }

      if (response.status === 404) {
        return NextResponse.json(
          {
            success: false,
            error: `تعذر العثور على ملف سير العمل (${config.workflow}) في المستودع (${config.repository}).`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: false, error: `فشل تشغيل سير العمل على GitHub (HTTP ${response.status}).` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "🚀 تم إطلاق مهمة الحصاد السحابي على GitHub Actions بنجاح! سيتم فحص وتجميع الصور في الخلفية وتحديث المكتبة.",
        repository: config.repository,
        workflowUrl: `https://github.com/${config.repository}/actions/workflows/${config.workflow}`,
        runsUrl: `https://github.com/${config.repository}/actions`,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[Image harvest] Dispatch request failed:", error);
    return NextResponse.json(
      { success: false, error: "تعذر الاتصال بخوادم GitHub API لتشغيل الحصاد." },
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

  const config = await getHarvestConfiguration();

  return NextResponse.json({
    success: true,
    status: {
      currentCount: count ?? 0,
      workflowConfigured: Boolean(config),
      repository: config?.repository ?? "azenithliving/azenith-living-os",
      workflow: config?.workflow ?? "run-harvester.yml",
      workflowUrl: config ? `https://github.com/${config.repository}/actions/workflows/${config.workflow}` : null,
      runsUrl: config ? `https://github.com/${config.repository}/actions` : null,
    },
  });
}
