import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

export const dynamic = "force-dynamic";

type KeyRow = {
  provider: string;
  is_active: boolean;
  cooldown_until: string | null;
  total_requests: number | null;
  last_used_at: string | null;
};

function authResponse(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json({ success: false, error: error.message }, { status: error.status })
    : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("provider, is_active, cooldown_until, total_requests, last_used_at")
      .order("provider");

    if (error) {
      console.error("[Keys Stats API] Fetch error:", error);
      return NextResponse.json({ success: false, error: "Failed to fetch key statistics" }, { status: 500 });
    }

    const keys = (data ?? []) as KeyRow[];
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const providerNames = [...new Set(keys.map((key) => key.provider))].sort();

    const providers = Object.fromEntries(providerNames.map((provider) => {
      const rows = keys.filter((key) => key.provider === provider);
      const totalRequests = rows.reduce((sum, key) => sum + (key.total_requests ?? 0), 0);
      const lastUsed = (key: KeyRow) => key.last_used_at ? Date.parse(key.last_used_at) : 0;
      return [provider, {
        provider,
        total_keys: rows.length,
        active_keys: rows.filter((key) => key.is_active).length,
        in_cooldown: rows.filter((key) => key.cooldown_until && Date.parse(key.cooldown_until) > now).length,
        total_requests: totalRequests,
        avg_requests_per_key: rows.length ? Math.round(totalRequests / rows.length) : 0,
        last_hour_requests: rows.filter((key) => lastUsed(key) > hourAgo).length,
        last_24h_requests: rows.filter((key) => lastUsed(key) > dayAgo).length,
      }];
    }));

    return NextResponse.json({
      success: true,
      providers,
      overall: {
        total_keys: keys.length,
        active_keys: keys.filter((key) => key.is_active).length,
        in_cooldown: keys.filter((key) => key.cooldown_until && Date.parse(key.cooldown_until) > now).length,
        total_requests: keys.reduce((sum, key) => sum + (key.total_requests ?? 0), 0),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const response = authResponse(error);
    if (response) return response;
    console.error("[Keys Stats API] Unexpected error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = await createClient();
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("api_keys")
      .update({ cooldown_until: null })
      .lt("cooldown_until", cutoff)
      .select("id");

    if (error) {
      console.error("[Keys Stats API] Sync error:", error);
      return NextResponse.json({ success: false, error: "Failed to sync key stats" }, { status: 500 });
    }

    return NextResponse.json({ success: true, reset_count: data?.length ?? 0 });
  } catch (error) {
    const response = authResponse(error);
    if (response) return response;
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
