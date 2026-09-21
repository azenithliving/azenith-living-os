import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = await createClient();
    const { data: keys, error } = await supabase.from("api_keys").select("provider, is_active, cooldown_until, total_requests, last_used_at").order("provider");
    if (error) return NextResponse.json({ success: false, error: "Failed to fetch key statistics" }, { status: 500 });
    const now = new Date();
    const hour = new Date(now.getTime() - 60 * 60 * 1000);
    const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const providers = [...new Set((keys || []).map((key) => key.provider))];
    const stats = Object.fromEntries(providers.map((provider) => {
      const rows = (keys || []).filter((key) => key.provider === provider);
      const totalRequests = rows.reduce((sum, key) => sum + (key.total_requests || 0), 0);
      return [provider, { provider, total_keys: rows.length, active_keys: rows.filter((key) => key.is_active).length, in_cooldown: rows.filter((key) => key.cooldown_until && new Date(key.cooldown_until) > now).length, total_requests: totalRequests, avg_requests_per_key: rows.length ? Math.round(totalRequests / rows.length) : 0, last_hour_requests: rows.filter((key) => key.last_used_at && new Date(key.last_used_at) > hour).length, last_24h_requests: rows.filter((key) => key.last_used_at && new Date(key.last_used_at) > day).length }];
    }));
    return NextResponse.json({ success: true, providers: stats, overall: { total_keys: keys?.length || 0, active_keys: (keys || []).filter((key) => key.is_active).length, in_cooldown: (keys || []).filter((key) => key.cooldown_until && new Date(key.cooldown_until) > now).length, total_requests: (keys || []).reduce((sum, key) => sum + (key.total_requests || 0), 0) }, timestamp: now.toISOString() });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error("[Keys Stats API] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = await createClient();
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from("api_keys").update({ cooldown_until: null }).lt("cooldown_until", cutoff).select("id");
    if (error) return NextResponse.json({ success: false, error: "Failed to sync key stats" }, { status: 500 });
    return NextResponse.json({ success: true, reset_count: data?.length || 0 });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
