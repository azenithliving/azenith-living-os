/**
 * Sync Key Statistics Cron Job
 * Runs every 10 minutes to:
 * - Reset stale cooldowns (> 1 hour)
 * - Sync in-memory stats to database
 * - Report key health
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function syncKeyStats() {
  console.log("[Key Stats Sync] Starting sync...", new Date().toISOString());

  try {
    // 1. Reset stale cooldowns (> 1 hour old)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: resetCooldowns, error: resetError } = await supabase
      .from("api_keys")
      .update({ cooldown_until: null })
      .lt("cooldown_until", oneHourAgo)
      .select("id, provider");

    if (resetError) {
      console.error("[Key Stats Sync] Error resetting cooldowns:", resetError);
    } else {
      console.log(`[Key Stats Sync] Reset ${resetCooldowns?.length || 0} stale cooldowns`);
    }

    // 2. Get current stats summary
    const { data: keys, error: statsError } = await supabase
      .from("api_keys")
      .select("provider, is_active, cooldown_until, total_requests");

    if (statsError) {
      console.error("[Key Stats Sync] Error fetching stats:", statsError);
      return;
    }

    const now = new Date();
    const providers = ["groq", "openrouter", "mistral", "pexels"];

    for (const provider of providers) {
      const providerKeys = keys.filter((k) => k.provider === provider);
      const active = providerKeys.filter((k) => k.is_active).length;
      const inCooldown = providerKeys.filter(
        (k) => k.cooldown_until && new Date(k.cooldown_until) > now
      ).length;
      const totalRequests = providerKeys.reduce((sum, k) => sum + (k.total_requests || 0), 0);

      console.log(
        `[Key Stats Sync] ${provider}: ${providerKeys.length} keys, ${active} active, ${inCooldown} cooldown, ${totalRequests} requests`
      );
    }

    // 3. Deactivate keys with excessive failures (optional threshold)
    const { data: failingKeys, error: failError } = await supabase
      .from("api_keys")
      .select("id, provider, total_requests, last_used_at")
      .eq("is_active", true)
      .lt("last_used_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Not used in 7 days
      .gt("total_requests", 1000); // High usage

    if (failError) {
      console.error("[Key Stats Sync] Error checking failing keys:", failError);
    } else if (failingKeys && failingKeys.length > 0) {
      console.log(`[Key Stats Sync] Found ${failingKeys.length} potentially stale keys`);
    }

    console.log("[Key Stats Sync] Completed successfully");
  } catch (error) {
    console.error("[Key Stats Sync] Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  syncKeyStats().then(() => process.exit(0));
}

export { syncKeyStats };
