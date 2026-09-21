import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type ImageRow = { room_type?: string | null; style?: string | null };

type DistributionEntry = {
  room_type: string;
  style: string;
  active_count: number;
};

async function loadImageRows(): Promise<{ rows: ImageRow[]; error?: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: [], error: "قاعدة البيانات غير مهيأة." };

  const rows: ImageRow[] = [];
  const pageSize = 1_000;
  let offset = 0;

  // Supabase applies a default response cap. Page through the table so the
  // aggregate represents actual rows rather than the first response only.
  while (true) {
    const { data, error } = await supabase
      .from("curated_images")
      .select("room_type, style")
      .eq("is_active", true)
      .range(offset, offset + pageSize - 1);

    if (error) return { rows: [], error: error.message };
    const page = (data ?? []) as ImageRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return { rows };
}

export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "قاعدة البيانات غير مهيأة." },
      { status: 503 }
    );
  }

  const [images, refreshLogs] = await Promise.all([
    loadImageRows(),
    supabase
      .from("refresh_logs")
      .select("id, status, duration_minutes, images_before, images_after, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (images.error) {
    return NextResponse.json(
      { success: false, error: `تعذر قراءة مكتبة الصور: ${images.error}` },
      { status: 500 }
    );
  }

  const distribution = new Map<string, DistributionEntry>();
  for (const image of images.rows) {
    const roomType = typeof image.room_type === "string" && image.room_type.trim()
      ? image.room_type.trim()
      : "غير مصنف";
    const style = typeof image.style === "string" && image.style.trim()
      ? image.style.trim()
      : "غير مصنف";
    const key = `${roomType}\u0000${style}`;
    const existing = distribution.get(key);
    if (existing) existing.active_count += 1;
    else distribution.set(key, { room_type: roomType, style, active_count: 1 });
  }

  const warnings = refreshLogs.error
    ? [`تعذر قراءة سجل التحديث: ${refreshLogs.error.message}`]
    : [];

  return NextResponse.json({
    success: true,
    stats: {
      total: images.rows.length,
      distribution: [...distribution.values()].sort((a, b) => b.active_count - a.active_count),
    },
    recentRefreshes: refreshLogs.data ?? [],
    warnings,
    retrievedAt: new Date().toISOString(),
  });
}
