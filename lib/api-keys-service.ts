/**
 * API Keys Service
 * Centralized service for managing API keys from database with fallback to env
 * SERVER ONLY - Do not import in client components
 */

"use server";

import { createClient } from "@/utils/supabase/server";

// Parse key pools from environment
const parseKeyPool = (envValue: string | undefined): string[] => {
  if (!envValue) return [];
  return envValue.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
};

// Environment key pools
const ENV_KEY_POOLS = {
  groq: parseKeyPool(process.env.GROQ_KEYS),
  openrouter: parseKeyPool(process.env.OPENROUTER_KEYS),
  mistral: parseKeyPool(process.env.MISTRAL_KEYS),
  pexels: parseKeyPool(process.env.PEXELS_KEYS),
  deepseek: parseKeyPool(process.env.DEEPSEEK_KEYS),
};

// In-memory key state
interface KeyState {
  key: string;
  cooldownUntil: Date | null;
  totalRequests: number;
  lastUsedAt: Date | null;
}

const keyStates: Record<string, KeyState[]> = {
  groq: [],
  openrouter: [],
  mistral: [],
  pexels: [],
  deepseek: [],
};

let keysLoaded = false;

/**
 * Load keys from database and merge with environment keys
 */
export async function loadKeysFromDB(): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("provider, key, cooldown_until, total_requests, last_used_at")
      .eq("is_active", true);

    if (error) {
      console.error("[API Keys Service] Failed to load keys from DB:", error);
      // Fall back to env keys
      fallbackToEnvKeys();
      return;
    }

    // Reset states
    keyStates.groq = [];
    keyStates.openrouter = [];
    keyStates.mistral = [];
    keyStates.pexels = [];

    // Add DB keys
    for (const row of data || []) {
      if (keyStates[row.provider]) {
        keyStates[row.provider].push({
          key: row.key,
          cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until) : null,
          totalRequests: row.total_requests || 0,
          lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
        });
      }
    }

    // Merge with env keys (avoid duplicates)
    for (const provider of ["groq", "openrouter", "mistral", "pexels", "deepseek"] as const) {
      const existingKeys = new Set(keyStates[provider].map((k) => k.key));
      for (const envKey of ENV_KEY_POOLS[provider]) {
        if (!existingKeys.has(envKey)) {
          keyStates[provider].push({
            key: envKey,
            cooldownUntil: null,
            totalRequests: 0,
            lastUsedAt: null,
          });
        }
      }
    }

    keysLoaded = true;
    console.log("[API Keys Service] Keys loaded:", {
      groq: keyStates.groq.length,
      openrouter: keyStates.openrouter.length,
      mistral: keyStates.mistral.length,
      pexels: keyStates.pexels.length,
    });
  } catch (err) {
    console.error("[API Keys Service] Error loading keys:", err);
    fallbackToEnvKeys();
  }
}

/**
 * Fallback to environment keys only
 */
function fallbackToEnvKeys(): void {
  for (const provider of ["groq", "openrouter", "mistral", "pexels", "deepseek"] as const) {
    keyStates[provider] = ENV_KEY_POOLS[provider].map((k) => ({
      key: k,
      cooldownUntil: null,
      totalRequests: 0,
      lastUsedAt: null,
    }));
  }
  keysLoaded = true;
}

/**
 * Get a single key from database (preferred) or environment
 */
export async function getKeyFromDB(
  provider: "groq" | "openrouter" | "mistral" | "pexels" | "deepseek"
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("api_keys")
      .select("key")
      .eq("provider", provider)
      .eq("is_active", true)
      .or(`cooldown_until.is.null,cooldown_until.lt.${now}`)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .single();

    if (data?.key) {
      return data.key;
    }

    // Fall back to environment
    const envKeys = ENV_KEY_POOLS[provider];
    return envKeys.length > 0 ? envKeys[0] : null;
  } catch (err) {
    // Fall back to environment on error
    const envKeys = ENV_KEY_POOLS[provider];
    return envKeys.length > 0 ? envKeys[0] : null;
  }
}

// Key rotation indices per provider
const keyIndices: Record<string, number> = {
  groq: 0,
  openrouter: 0,
  mistral: 0,
  pexels: 0,
  deepseek: 0,
};

/**
 * Get next available key using round-robin with cooldown support
 */
export async function getNextAvailableKey(
  provider: "groq" | "openrouter" | "mistral" | "pexels" | "deepseek"
): Promise<{ key: string; index: number } | null> {
  if (!keysLoaded) {
    await loadKeysFromDB();
  }

  const pool = keyStates[provider];
  if (pool.length === 0) return null;

  const now = new Date();
  const startIndex = keyIndices[provider];
  let attempts = 0;

  while (attempts < pool.length) {
    const currentIndex = (startIndex + attempts) % pool.length;
    const keyEntry = pool[currentIndex];

    // Skip keys in cooldown
    if (keyEntry.cooldownUntil && keyEntry.cooldownUntil > now) {
      attempts++;
      continue;
    }

    // Update index for next call
    keyIndices[provider] = (currentIndex + 1) % pool.length;

    // Update in-memory stats
    keyEntry.totalRequests++;
    keyEntry.lastUsedAt = new Date();

    return { key: keyEntry.key, index: currentIndex };
  }

  // All keys in cooldown, return first anyway
  keyIndices[provider] = (startIndex + 1) % pool.length;
  return pool[startIndex] ? { key: pool[startIndex].key, index: startIndex } : null;
}

/**
 * Set cooldown for a specific key
 */
export async function setKeyCooldown(
  provider: "groq" | "openrouter" | "mistral" | "pexels" | "deepseek",
  key: string,
  durationMs: number
): Promise<void> {
  const cooldownUntil = new Date(Date.now() + durationMs);

  // Update in-memory
  const pool = keyStates[provider];
  const keyEntry = pool.find((k) => k.key === key);
  if (keyEntry) {
    keyEntry.cooldownUntil = cooldownUntil;
  }

  // Update in database
  try {
    const supabase = await createClient();
    await supabase
      .from("api_keys")
      .update({
        cooldown_until: cooldownUntil.toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .eq("provider", provider)
      .eq("key", key);
  } catch (err) {
    // Silent fail - cooldown tracked in-memory
  }
}

/**
 * Increment request count for a key
 */
export async function incrementKeyUsage(
  provider: "groq" | "openrouter" | "mistral" | "pexels" | "deepseek",
  key: string
): Promise<void> {
  // Update in-memory
  const pool = keyStates[provider];
  const keyEntry = pool.find((k) => k.key === key);
  if (keyEntry) {
    keyEntry.totalRequests++;
    keyEntry.lastUsedAt = new Date();
  }

  // Update in database (async, don't wait)
  try {
    const supabase = await createClient();
    await supabase
      .from("api_keys")
      .update({
        total_requests: keyEntry?.totalRequests || 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("provider", provider)
      .eq("key", key);
  } catch (err) {
    // Silent fail
  }
}

/**
 * Get all key stats for a provider
 */
export async function getKeyStats(provider: "groq" | "openrouter" | "mistral" | "pexels" | "deepseek"): Promise<{
  total: number;
  active: number;
  inCooldown: number;
  totalRequests: number;
}> {
  if (!keysLoaded) {
    await loadKeysFromDB();
  }

  const pool = keyStates[provider];
  const now = new Date();

  return {
    total: pool.length,
    active: pool.filter((k) => !k.cooldownUntil || k.cooldownUntil <= now).length,
    inCooldown: pool.filter((k) => k.cooldownUntil && k.cooldownUntil > now).length,
    totalRequests: pool.reduce((sum, k) => sum + k.totalRequests, 0),
  };
}
