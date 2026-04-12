/**
 * API Keys Statistics API
 * Returns usage statistics for all API keys by provider
 */

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

interface KeyStats {
  provider: string;
  total_keys: number;
  active_keys: number;
  in_cooldown: number;
  total_requests: number;
  avg_requests_per_key: number;
  last_hour_requests: number;
  last_24h_requests: number;
}

/**
 * GET /api/admin/keys/stats
 * Returns aggregated key usage statistics
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get all keys with their stats
    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("provider, is_active, cooldown_until, total_requests, last_used_at")
      .order("provider");

    if (error) {
      console.error("[Keys Stats API] Error fetching stats:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch key statistics" },
        { status: 500 }
      );
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Aggregate stats by provider
    const stats: Record<string, KeyStats> = {};
    const providers = ["groq", "openrouter", "mistral", "pexels"];

    for (const provider of providers) {
      const providerKeys = keys.filter((k) => k.provider === provider);

      const totalRequests = providerKeys.reduce((sum, k) => sum + (k.total_requests || 0), 0);

      const lastHourRequests = providerKeys.filter(
        (k) => k.last_used_at && new Date(k.last_used_at) > oneHourAgo
      ).length;

      const last24hRequests = providerKeys.filter(
        (k) => k.last_used_at && new Date(k.last_used_at) > oneDayAgo
      ).length;

      stats[provider] = {
        provider,
        total_keys: providerKeys.length,
        active_keys: providerKeys.filter((k) => k.is_active).length,
        in_cooldown: providerKeys.filter(
          (k) => k.cooldown_until && new Date(k.cooldown_until) > now
        ).length,
        total_requests: totalRequests,
        avg_requests_per_key: providerKeys.length > 0 ? Math.round(totalRequests / providerKeys.length) : 0,
        last_hour_requests: lastHourRequests,
        last_24h_requests: last24hRequests,
      };
    }

    // Calculate overall stats
    const overall = {
      total_keys: keys.length,
      active_keys: keys.filter((k) => k.is_active).length,
      in_cooldown: keys.filter((k) => k.cooldown_until && new Date(k.cooldown_until) > now).length,
      total_requests: keys.reduce((sum, k) => sum + (k.total_requests || 0), 0),
    };

    return NextResponse.json({
      success: true,
      providers: stats,
      overall,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[Keys Stats API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/keys/stats
 * Refresh or update key statistics (manual sync trigger)
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // Reset any stale cooldowns (cooldowns older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("api_keys")
      .update({ cooldown_until: null })
      .lt("cooldown_until", oneHourAgo)
      .select("id");

    if (error) {
      console.error("[Keys Stats API] Error resetting stale cooldowns:", error);
      return NextResponse.json(
        { success: false, error: "Failed to sync key stats" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Synced key statistics. Reset ${data?.length || 0} stale cooldowns.`,
      reset_count: data?.length || 0,
    });
  } catch (error) {
    console.error("[Keys Stats API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
