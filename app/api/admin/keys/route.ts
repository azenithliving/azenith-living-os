import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { reloadKeys, getAllLiveStats } from "@/lib/api-keys-service";
import { smartTestKey } from "@/lib/key-tester";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

function authResponse(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json({ success: false, error: error.message }, { status: error.status })
    : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });

    const [dbResult, liveStats] = await Promise.all([
      supabase.from("api_keys").select("*").order("provider").order("created_at", { ascending: false }),
      getAllLiveStats(),
    ]);
    if (dbResult.error) throw dbResult.error;

    const grouped: Record<string, any> = {};
    const now = new Date();
    for (const key of dbResult.data || []) {
      const provider = key.provider;
      grouped[provider] ??= { provider, keys: [], stats: { total: 0, active: 0, inactive: 0, backup: 0, inCooldown: 0, dead: 0, live: liveStats[provider] || { live_total: 0, live_active: 0, live_cooldown: 0, live_dead: 0, live_requests: 0, loaded: false } } };
      const isDead = Boolean(key.error_count >= 3 || ["401", "403", "Invalid", "Unauthorized", "Forbidden"].some((value) => String(key.last_error || "").includes(value)) || String(key.last_error || "").startsWith("[DEAD]"));
      const inCooldown = Boolean(key.cooldown_until && new Date(key.cooldown_until) > now);
      grouped[provider].keys.push({ id: key.id, key: `${key.key.substring(0, 12)}...${key.key.slice(-4)}`, keyFull: key.key, isActive: key.is_active, isBackup: key.is_backup, notes: key.notes, cooldownUntil: key.cooldown_until, totalRequests: key.total_requests || 0, lastUsedAt: key.last_used_at, createdAt: key.created_at, isDead, lastError: key.last_error, errorCount: key.error_count || 0 });
      grouped[provider].stats.total++;
      if (isDead) grouped[provider].stats.dead++;
      else if (key.is_backup) grouped[provider].stats.backup++;
      else if (inCooldown) grouped[provider].stats.inCooldown++;
      else if (key.is_active) grouped[provider].stats.active++;
      else grouped[provider].stats.inactive++;
    }
    return NextResponse.json({ success: true, providers: Object.values(grouped), liveStats });
  } catch (error) {
    const response = authResponse(error);
    if (response) return response;
    console.error("[Admin API] GET keys error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch keys" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const body = await request.json();
    const provider = String(body.provider || "").trim().toLowerCase();
    const key = String(body.key || "").trim();
    if (!provider || !key) return NextResponse.json({ success: false, error: "Provider and key are required" }, { status: 400 });

    if (body.testKey) {
      const result = await smartTestKey(provider, key);
      if (!result.valid) return NextResponse.json({ success: false, error: "Key test failed", details: result.error || "المفتاح غير صحيح" }, { status: 400 });
    }
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database not available" }, { status: 503 });
    const { data, error } = await supabase.from("api_keys").insert({ provider, key, notes: body.notes || null, is_backup: Boolean(body.isBackup), is_active: true }).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    const reload = await reloadKeys();
    if (!reload.success) return NextResponse.json({ success: false, error: reload.error || "Key saved but reload failed", persisted: true, key: { id: data.id, provider: data.provider } }, { status: 502 });
    return NextResponse.json({ success: true, key: { id: data.id, provider: data.provider, isBackup: data.is_backup } });
  } catch (error) {
    const response = authResponse(error);
    if (response) return response;
    console.error("[Admin API] POST key error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
