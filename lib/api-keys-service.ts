/**
 * API Keys Service
 * Centralized service for managing API keys from database
 * ⚠️ DB-ONLY MODE - No longer reads from env variables
 * SERVER ONLY - Do not import in client components
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// ⚠️ ENV parsing disabled - kept for emergency fallback only
// Uncomment parseKeyPool and ENV_KEY_POOLS if you need to revert to env mode
/*
const parseKeyPool = (envPrefix: string): string[] => {
  let allKeys: string[] = [];
  if (process.env[envPrefix]) {
    allKeys = allKeys.concat(process.env[envPrefix]!.split(",").map((k) => k.trim()).filter(Boolean));
  }
  for (let i = 1; i <= 20; i++) {
    const chunkName = `${envPrefix}_${i}`;
    if (process.env[chunkName]) {
      allKeys = allKeys.concat(process.env[chunkName]!.split(",").map((k) => k.trim()).filter(Boolean));
    }
  }
  return Array.from(new Set(allKeys));
};
*/

type ApiKeyProvider = 
  | "groq" | "openrouter" | "mistral" | "pexels" | "deepseek"
  | "google" | "together"
  | "cerebras" | "cohere" | "aimlapi"
  | "nvidia" | "chutes"
  | "cloudflare" | "huggingface"
  | "apifreellm" | "bytez" | "api_ninjas";

const PROVIDERS: ApiKeyProvider[] = [
  "groq", "openrouter", "mistral", "pexels", "deepseek",
  "google", "together",
  "cerebras", "cohere", "aimlapi",
  "nvidia", "chutes",
  "cloudflare", "huggingface",
  "apifreellm", "bytez", "api_ninjas",
];

// In-memory key state
interface KeyState {
  key: string;
  cooldownUntil: Date | null;
  totalRequests: number;
  lastUsedAt: Date | null;
  isDead?: boolean;
  lastError?: string | null;
}

const keyStates: Record<string, KeyState[]> = {
  groq:        [],
  openrouter:  [],
  mistral:     [],
  pexels:      [],
  deepseek:    [],
  google:      [],
  together:    [],
  cerebras:    [],
  cohere:      [],
  aimlapi:     [],
  nvidia:      [],
  chutes:      [],
  cloudflare:  [],
  huggingface: [],
  apifreellm:  [],
  bytez:       [],
  api_ninjas:  [],
};

let keysLoaded = false;
let lastLoadTime = 0;
const RELOAD_INTERVAL_MS = 5 * 60 * 1000; // 5 دقائق max cache

/**
 * Load keys from database ONLY
 * ⚠️ No longer falls back to env variables - DB is the single source of truth
 */
export async function loadKeysFromDB(): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[API Keys Service] ❌ Admin client not available. No keys will be loaded.");
      keysLoaded = true;
      return;
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("provider, key, cooldown_until, total_requests, last_used_at, last_error, error_count, is_active, is_backup");

    if (error) {
      console.error("[API Keys Service] Failed to load keys from DB:", error);
      keysLoaded = true;
      return;
    }

    // Reset states
    Object.keys(keyStates).forEach(k => { keyStates[k] = []; });

    // Add DB keys — فقط المفاتيح النشطة وغير الميتة تدخل الذاكرة
    for (const row of data || []) {
      const provider = row.provider?.toLowerCase();
      if (!keyStates[provider]) continue;

      // مفتاح يُعتبر "ميت" لو عنده 3 أخطاء متتالية أو رسالة خطأ واضحة
      const isDead =
        (row.error_count && row.error_count >= 3) ||
        (row.last_error && (
          row.last_error.includes("401") ||
          row.last_error.includes("403") ||
          row.last_error.includes("Invalid") ||
          row.last_error.includes("Unauthorized") ||
          row.last_error.includes("Forbidden") ||
          row.last_error.startsWith("[DEAD]")
        ));

      // ⚠️ المفاتيح الميتة أو غير النشطة لا تدخل حوض الذاكرة النشط
      // المفاتيح الاحتياطية (is_backup) تُضاف لكن تُعامَل بشكل منفصل
      if (isDead || !row.is_active) continue;

      keyStates[provider].push({
        key:           row.key,
        cooldownUntil: row.cooldown_until ? new Date(row.cooldown_until) : null,
        totalRequests: row.total_requests || 0,
        lastUsedAt:    row.last_used_at   ? new Date(row.last_used_at)   : null,
        isDead:        false,
        lastError:     row.last_error || null,
      });
    }

    keysLoaded = true;
    lastLoadTime = Date.now();
    console.log("[API Keys Service] ✅ Keys loaded from DB:", Object.fromEntries(
      Object.entries(keyStates).map(([k, v]) => [k, v.length])
    ));
  } catch (err) {
    console.error("[API Keys Service] Error loading keys:", err);
    keysLoaded = true;
  }
}

/**
 * Get a single key from database
 * ⚠️ No longer falls back to env - DB only
 */
export async function getKeyFromDB(
  provider: ApiKeyProvider
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;

    const now = new Date().toISOString();

    const { data } = await supabase
      .from("api_keys")
      .select("key")
      .eq("provider", provider)
      .eq("is_active", true)
      .or(`cooldown_until.is.null,cooldown_until.lt.${now}`)
      .order("last_used_at", { ascending: true, nullsFirst: true })
      .limit(1)
      .maybeSingle<{ key: string }>();

    return data?.key || null;
  } catch (err) {
    return null;
  }
}

// Key rotation indices per provider
const keyIndices: Record<string, number> = {
  groq:        0,
  openrouter:  0,
  mistral:     0,
  pexels:      0,
  deepseek:    0,
  google:      0,
  together:    0,
  cerebras:    0,
  cohere:      0,
  aimlapi:     0,
  nvidia:      0,
  chutes:      0,
  cloudflare:  0,
  huggingface: 0,
  apifreellm:  0,
  bytez:       0,
  api_ninjas:  0,
};

/**
 * Get next available key using round-robin with cooldown support
 * ⚠️ SKIPS DEAD KEYS COMPLETELY - they never enter the work cycle
 */
export async function getNextAvailableKey(
  provider: ApiKeyProvider
): Promise<{ key: string; index: number } | null> {
  if (!keysLoaded || (Date.now() - lastLoadTime > RELOAD_INTERVAL_MS)) {
    await loadKeysFromDB();
  }

  const pool = keyStates[provider];
  if (!pool || pool.length === 0) return null;

  const now = new Date();
  const startIndex = keyIndices[provider];
  let attempts = 0;

  while (attempts < pool.length) {
    const currentIndex = (startIndex + attempts) % pool.length;
    const keyEntry = pool[currentIndex];

    // ⚠️ CRITICAL: Skip dead keys completely - they NEVER get used
    if (keyEntry.isDead) {
      attempts++;
      continue;
    }

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

  // All keys in cooldown or dead - try to find any non-dead key
  const firstNonDead = pool.find(k => !k.isDead);
  if (firstNonDead) {
    keyIndices[provider] = (startIndex + 1) % pool.length;
    return { key: firstNonDead.key, index: pool.indexOf(firstNonDead) };
  }

  return null; // No usable keys available
}

/**
 * Set cooldown for a specific key
 */
export async function setKeyCooldown(
  provider: ApiKeyProvider,
  key: string,
  durationMs: number
): Promise<void> {
  const cooldownUntil = new Date(Date.now() + durationMs);

  // Update in-memory
  const pool = keyStates[provider];
  if (!pool) return;
  const keyEntry = pool.find((k) => k.key === key);
  if (keyEntry) {
    keyEntry.cooldownUntil = cooldownUntil;
  }

  // Update in database
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          cooldown_until: cooldownUntil.toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq("provider", provider)
        .eq("key", key);
    }
  } catch (err) {
    // Silent fail - cooldown tracked in-memory
  }
}

/**
 * Increment request count for a key
 */
export async function incrementKeyUsage(
  provider: ApiKeyProvider,
  key: string
): Promise<void> {
  // Update in-memory
  const pool = keyStates[provider];
  if (!pool) return;
  const keyEntry = pool.find((k) => k.key === key);
  if (keyEntry) {
    keyEntry.totalRequests++;
    keyEntry.lastUsedAt = new Date();
  }

  // Update in database (async, don't wait)
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          total_requests: keyEntry?.totalRequests || 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("provider", provider)
        .eq("key", key);
    }
  } catch (err) {
    // Silent fail
  }
}

/**
 * Get all key stats for a provider
 */
export async function getKeyStats(provider: ApiKeyProvider): Promise<{
  total: number;
  active: number;
  inCooldown: number;
  totalRequests: number;
}> {
  if (!keysLoaded || (Date.now() - lastLoadTime > RELOAD_INTERVAL_MS)) {
    await loadKeysFromDB();
  }

  const pool = keyStates[provider] || [];
  const now = new Date();

  return {
    total: pool.length,
    active: pool.filter((k) => !k.cooldownUntil || k.cooldownUntil <= now).length,
    inCooldown: pool.filter((k) => k.cooldownUntil && k.cooldownUntil > now).length,
    totalRequests: pool.reduce((sum, k) => sum + k.totalRequests, 0),
  };
}

/**
 * ✅ Get LIVE in-memory stats for ALL providers
 * هذه هي الأرقام الحقيقية - ما يشتغل فعلاً في الـ server
 */
export async function getAllLiveStats(): Promise<Record<string, {
  live_total: number;       // عدد المفاتيح المحملة فعلاً في الذاكرة
  live_active: number;      // متاح للاستخدام الآن (مش cooldown ومش dead)
  live_cooldown: number;    // في cooldown حالياً
  live_dead: number;        // محدد كـ dead في الذاكرة
  live_requests: number;    // مجموع الطلبات منذ بدء الـ server
  loaded: boolean;          // هل تم تحميل المفاتيح؟
}>> {
  if (!keysLoaded || (Date.now() - lastLoadTime > RELOAD_INTERVAL_MS)) {
    await loadKeysFromDB();
  }

  const now = new Date();
  const result: Record<string, any> = {};

  for (const provider of PROVIDERS) {
    const pool = keyStates[provider] || [];
    result[provider] = {
      live_total: pool.length,
      live_active: pool.filter(k => !k.isDead && (!k.cooldownUntil || k.cooldownUntil <= now)).length,
      live_cooldown: pool.filter(k => !k.isDead && k.cooldownUntil && k.cooldownUntil > now).length,
      live_dead: pool.filter(k => k.isDead === true).length,
      live_requests: pool.reduce((sum, k) => sum + k.totalRequests, 0),
      loaded: keysLoaded,
    };
  }

  return result;
}

/**
 * Hot-reload keys from database without server restart
 * Called from admin panel after adding/removing/editing keys
 */
export async function reloadKeys(): Promise<{
  success: boolean;
  providers: Record<string, number>;
  error?: string;
}> {
  try {
    console.log("[API Keys Service] Hot-reloading keys from database...");
    
    // Reset the loaded flag to force fresh load
    keysLoaded = false;
    
    // Reload from database
    await loadKeysFromDB();
    
    // Collect stats for response
    const providers: Record<string, number> = {};
    for (const provider of PROVIDERS) {
      providers[provider] = keyStates[provider].length;
    }
    
    console.log("[API Keys Service] ✅ Hot-reload complete:", providers);
    
    return {
      success: true,
      providers,
    };
  } catch (error: any) {
    console.error("[API Keys Service] ❌ Hot-reload failed:", error);
    return {
      success: false,
      providers: {},
      error: error.message || "Unknown error during reload",
    };
  }
}

/**
 * Mark a key as dead (failed permanently)
 */
export async function markKeyAsDead(
  provider: ApiKeyProvider,
  key: string,
  errorMessage: string
): Promise<void> {
  // Update in-memory
  const pool = keyStates[provider];
  if (!pool) return;
  const keyEntry = pool.find((k) => k.key === key);
  if (keyEntry) {
    keyEntry.isDead = true;
    keyEntry.lastError = errorMessage;
  }

  // Update in database
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          is_active: false,
          last_error: errorMessage,
          error_count: 999, // رقم كبير يعني "ميت نهائياً"
        })
        .eq("provider", provider)
        .eq("key", key);
    }
  } catch (err) {
    console.error("[API Keys] Failed to mark key as dead:", err);
  }
}

/**
 * Increment error count for a key (3 errors = dead)
 * ⚠️ النظام يستدعي autoMoveDeadKeyToFilter تلقائياً عند 3 أخطاء
 */
export async function incrementKeyError(
  provider: ApiKeyProvider,
  key: string,
  errorMessage: string
): Promise<void> {
  const pool = keyStates[provider];
  if (!pool) return;
  const keyEntry = pool.find((k) => k.key === key);
  
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    // Get current error count
    const { data } = await supabase
      .from("api_keys")
      .select("error_count")
      .eq("provider", provider)
      .eq("key", key)
      .maybeSingle();

    const newErrorCount = (data?.error_count || 0) + 1;

    // Update database
    await supabase
      .from("api_keys")
      .update({
        last_error: errorMessage,
        error_count: newErrorCount,
      })
      .eq("provider", provider)
      .eq("key", key);

    // Update in-memory
    if (keyEntry) {
      keyEntry.lastError = errorMessage;
    }

    console.log(`[API Keys] ${provider} key error count: ${newErrorCount}/3`);

    // ⚠️ AUTOMATIC: Move to dead filter after 3 errors
    if (newErrorCount >= 3) {
      await autoMoveDeadKeyToFilter(provider, key, errorMessage);
    }
  } catch (err) {
    console.error("[API Keys] Failed to increment error count:", err);
  }
}

/**
 * Reset error count for a key (when it succeeds)
 */
export async function resetKeyErrors(
  provider: ApiKeyProvider,
  key: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          error_count: 0,
          last_error: null,
        })
        .eq("provider", provider)
        .eq("key", key);
    }
  } catch (err) {
    // Silent fail
  }
}

/**
 * Auto-move key to backup when limit is near (automatically triggered)
 * النظام يستدعي هذه الدالة تلقائياً عند اقتراب الليمت
 */
export async function autoMoveToBackup(
  provider: ApiKeyProvider,
  key: string,
  reason: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          is_backup: true,
          last_error: `Auto-moved to backup: ${reason}`,
        })
        .eq("provider", provider)
        .eq("key", key);
      
      console.log(`[API Keys] ✅ Auto-moved ${provider} key to BACKUP: ${reason}`);
    }
  } catch (err) {
    console.error("[API Keys] Failed to auto-move to backup:", err);
  }
}

/**
 * Auto-activate backup key when needed (automatically triggered)
 * النظام يستدعي هذه الدالة تلقائياً عند الحاجة لمفاتيح إضافية
 */
export async function autoActivateBackupKey(
  provider: ApiKeyProvider
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;

    // Find first backup key
    const { data } = await supabase
      .from("api_keys")
      .select("key, id")
      .eq("provider", provider)
      .eq("is_backup", true)
      .eq("is_active", false)
      .limit(1)
      .maybeSingle();

    if (data) {
      // Activate it
      await supabase
        .from("api_keys")
        .update({
          is_active: true,
          is_backup: false,
          last_error: "Auto-activated from backup",
        })
        .eq("id", data.id);

      console.log(`[API Keys] ✅ Auto-activated BACKUP key for ${provider}`);
      
      // Reload keys to update in-memory state
      await reloadKeys();
      
      return data.key;
    }

    return null;
  } catch (err) {
    console.error("[API Keys] Failed to auto-activate backup:", err);
    return null;
  }
}

/**
 * Auto-move dead key out of work cycle (automatically triggered)
 * ⚠️ النظام ينقل المفتاح الميت للفلتر الخاص بيه ويوقفه عن العمل تماماً
 * ⚠️ لكن لا يحذفه نهائياً - الحذف يدوي فقط
 */
export async function autoMoveDeadKeyToFilter(
  provider: ApiKeyProvider,
  key: string,
  errorMessage: string
): Promise<void> {
  // Update in-memory immediately
  const pool = keyStates[provider];
  if (pool) {
    const keyEntry = pool.find((k) => k.key === key);
    if (keyEntry) {
      keyEntry.isDead = true;
      keyEntry.lastError = errorMessage;
    }
  }

  // Update in database
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("api_keys")
        .update({
          is_active: false, // ← إيقاف من العمل تماماً
          is_backup: false, // ← إزالة من الاحتياطي
          error_count: 999, // ← رقم يدل على "ميت"
          last_error: `[DEAD] ${errorMessage}`,
        })
        .eq("provider", provider)
        .eq("key", key);
      
      console.log(`[API Keys] 💀 Auto-moved DEAD key to filter (removed from work cycle): ${provider}`);
    }
  } catch (err) {
    console.error("[API Keys] Failed to auto-move dead key:", err);
  }
}
