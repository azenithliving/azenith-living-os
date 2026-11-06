import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/admin/passkeys/list — the keys enrolled on the admin's own account.
 *
 * The service credential reads it, because a locked drawer and an empty drawer answer the same way to
 * the browser key (measured 2026-11-06). The payload carries the owner's own labels and dates only:
 * the credential id is a machine identifier and belongs in the record, not on his screen.
 */
export async function GET() {
  const { user, unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ measured: false, error: "مفتاح المتجر مش ضابط — مفاتيح الدخول ما قريتش" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("user_public_keys")
    .select("label, created_at, device_type, backed_up")
    .eq("user_id", user?.id);

  if (error) {
    console.error("[PasskeyList] refused:", error);
    return NextResponse.json({ measured: false, error: "مفاتيح الدخول ما قريتش — السبب اتسجل في اللوج، والعدد ده ما اتقارش" }, { status: 500 });
  }

  return NextResponse.json({
    measured: true,
    keys: (data ?? []).map((row: { label: string | null; created_at: string; device_type: string; backed_up: boolean }) => ({
      label: row.label ?? "مفتاح من غير اسم",
      enrolledAt: row.created_at,
      multiDevice: row.device_type === "multiDevice",
      backedUp: Boolean(row.backed_up),
    })),
  });
}
