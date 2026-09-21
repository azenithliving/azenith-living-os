import { NextRequest, NextResponse } from "next/server";
import { reloadKeys } from "@/lib/api-keys-service";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    const result = await reloadKeys();
    if (!result.success) return NextResponse.json({ success: false, error: result.error || "Failed to reload keys" }, { status: 500 });
    return NextResponse.json({ success: true, providers: result.providers, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Admin API] Reload error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
