/**
 * Key Monitoring Agent
 * Monitors API key usage and automatically activates backup keys when needed
 * Usage tracked in logs/key-usage.json
 */

import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { sendSecurityAlert } from "./telegram-notify";
import fs from "fs";
import path from "path";

// Usage threshold (90% of daily quota)
const USAGE_THRESHOLD_PERCENT = 90;

// Daily request limits by provider (user-specified limits)
const DAILY_LIMITS: Record<string, number> = {
  groq: 1000,         // 1000 requests per day
  openrouter: 500,    // 500 requests per day
  mistral: 500,       // 500 requests per day
  pexels: 200,        // 200 requests per hour
};

// Path to usage log file
const USAGE_LOG_PATH = path.join(process.cwd(), "logs", "key-usage.json");

// Ensure logs directory exists
function ensureLogsDir() {
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Read usage log
function readUsageLog(): Record<string, { count: number; lastUsed: string }> {
  try {
    ensureLogsDir();
    if (!fs.existsSync(USAGE_LOG_PATH)) {
      return {};
    }
    const content = fs.readFileSync(USAGE_LOG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Write usage log
function writeUsageLog(log: Record<string, { count: number; lastUsed: string }>) {
  try {
    ensureLogsDir();
    fs.writeFileSync(USAGE_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (error) {
    console.error("[KeyMonitor] Failed to write usage log:", error);
  }
}

export interface KeyUsageInfo {
  id: string;
  provider: string;
  key: string;
  is_active: boolean;
  total_requests: number;
  daily_requests: number;
  usage_percent: number;
  status: "healthy" | "warning" | "critical" | "exhausted";
  last_used_at: string | null;
}

export interface KeyCheckResult {
  checked_at: string;
  total_keys: number;
  active_keys: number;
  providers: ProviderInfo[];
  exhausted_keys: KeyUsageInfo[];
  warnings: string[];
  has_usage_data: boolean;
}

export interface ProviderInfo {
  provider: string;
  total_keys: number;
  active_keys: number;
  estimated_usage: number;
}

/**
 * Increment usage count for a key
 * Called after successful API calls
 */
export function incrementKeyUsage(provider: string, key: string): void {
  try {
    const usageLog = readUsageLog();
    const keyHash = `${provider}:${key.substring(0, 8)}`; // Use first 8 chars as key identifier

    const current = usageLog[keyHash] || { count: 0, lastUsed: new Date().toISOString() };
    current.count++;
    current.lastUsed = new Date().toISOString();

    usageLog[keyHash] = current;
    writeUsageLog(usageLog);

    console.log(`[KeyMonitor] Usage incremented for ${provider}: ${current.count} total`);
  } catch (error) {
    console.error("[KeyMonitor] Failed to increment usage:", error);
  }
}

/**
 * Get usage count for a key
 */
export function getKeyUsage(provider: string, key: string): { count: number; lastUsed: string | null } {
  try {
    const usageLog = readUsageLog();
    const keyHash = `${provider}:${key.substring(0, 8)}`;
    const entry = usageLog[keyHash];
    return entry || { count: 0, lastUsed: null };
  } catch {
    return { count: 0, lastUsed: null };
  }
}

/**
 * Reset daily usage (should be called once per day)
 */
export function resetDailyUsage(): void {
  try {
    writeUsageLog({});
    console.log("[KeyMonitor] Daily usage reset");
  } catch (error) {
    console.error("[KeyMonitor] Failed to reset usage:", error);
  }
}

/**
 * Check all API keys usage and activate backups if needed
 * This is the main monitoring function
 */
export async function checkKeysUsage(): Promise<KeyCheckResult> {
  console.log("[KeyMonitor] Starting key usage check...");

  // const supabase = await createClient(); // Centralized singleton used
  const result: KeyCheckResult = {
    checked_at: new Date().toISOString(),
    total_keys: 0,
    active_keys: 0,
    providers: [],
    exhausted_keys: [],
    warnings: [],
    has_usage_data: false,
  };

  try {
    // Fetch all keys from database
    const { data: allKeys, error } = await supabase
      .from("api_keys")
      .select("id, provider, key, is_active, total_requests, last_used_at, created_at")
      .order("provider", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch keys: ${error.message}`);
    }

    result.total_keys = allKeys?.length || 0;

    // Read usage log
    const usageLog = readUsageLog();
    const hasUsageData = Object.keys(usageLog).length > 0;
    result.has_usage_data = hasUsageData;

    // Group keys by provider
    const keysByProvider: Record<string, typeof allKeys> = {};
    for (const key of allKeys || []) {
      if (!keysByProvider[key.provider]) {
        keysByProvider[key.provider] = [];
      }
      keysByProvider[key.provider].push(key);

      if (key.is_active) {
        result.active_keys++;
      }
    }

    // Build provider summary
    for (const [provider, keys] of Object.entries(keysByProvider)) {
      const activeCount = keys.filter(k => k.is_active).length;

      // Calculate estimated usage for this provider
      let providerUsage = 0;
      for (const key of keys) {
        const usage = getKeyUsage(provider, key.key);
        providerUsage += usage.count;
      }

      result.providers.push({
        provider,
        total_keys: keys.length,
        active_keys: activeCount,
        estimated_usage: providerUsage,
      });

      const dailyLimit = DAILY_LIMITS[provider] || 1000;

      for (const key of keys) {
        // Get usage from log file
        const usage = getKeyUsage(provider, key.key);
        const dailyRequests = usage.count;
        const usagePercent = (dailyRequests / dailyLimit) * 100;

        let status: KeyUsageInfo["status"] = "healthy";
        if (usagePercent >= 100) {
          status = "exhausted";
        } else if (usagePercent >= USAGE_THRESHOLD_PERCENT) {
          status = "critical";
        } else if (usagePercent >= 70) {
          status = "warning";
        }

        const keyInfo: KeyUsageInfo = {
          id: key.id,
          provider: key.provider,
          key: maskKey(key.key),
          is_active: key.is_active,
          total_requests: usage.count,
          daily_requests: dailyRequests,
          usage_percent: Math.round(usagePercent * 100) / 100,
          status,
          last_used_at: usage.lastUsed,
        };

        // If key is exhausted or critical, add to exhausted list
        if (status === "exhausted" || status === "critical") {
          result.exhausted_keys.push(keyInfo);

          // Log warning for exhausted keys
          result.warnings.push(`Key ${key.id} for ${provider} is ${status} (${usagePercent.toFixed(1)}% used)`);

          // Send alert for exhausted keys
          if (status === "exhausted") {
            await sendSecurityAlert(
              `🚨 <b>Key Exhausted</b>\n\n` +
              `Provider: ${provider.toUpperCase()}\n` +
              `Key ID: ${key.id}\n` +
              `Usage: ${usagePercent.toFixed(1)}% of daily limit\n\n` +
              `⚠️ Consider adding a new key to avoid service disruption!`
            );
          }

          // Auto-activate backup key when critical (95%+)
          if (status === "critical" || status === "exhausted") {
            const backupActivated = await activateBackupKey(supabase, provider, key.id);
            if (backupActivated) {
              result.warnings.push(`✅ Auto-activated backup key for ${provider} (key ${key.id} was ${status})`);
            }
          }
        }
      }
    }

    // Log the check to immutable log
    await logKeyCheck(supabase, result);

    console.log("[KeyMonitor] Check complete:", {
      total: result.total_keys,
      active: result.active_keys,
      exhausted: result.exhausted_keys.length,
      warnings: result.warnings.length,
    });

    return result;
  } catch (error) {
    console.error("[KeyMonitor] Error checking keys:", error);

    // Send error notification
    await sendSecurityAlert(
      `❌ <b>Key Monitor Error</b>\n\n` +
      `Error: ${error instanceof Error ? error.message : "Unknown error"}\n` +
      `Time: ${new Date().toISOString()}`
    );

    throw error;
  }
}

/**
 * Estimate daily requests for a key
 * Uses total_requests from the last 24h or estimates from command logs
 */
function estimateDailyRequests(
  key: { id: string; provider: string; total_requests: number },
  todayLogs: { executed_at: string; parameters: any }[]
): number {
  // For now, use total_requests as a proxy
  // In production, you'd want to track daily usage per key in a separate table
  const baseRequests = key.total_requests || 0;

  // Count relevant commands from today as additional usage indicator
  const relevantCommands = todayLogs.filter(log => {
    const params = log.parameters || {};
    return params.provider === key.provider || params.key_id === key.id;
  }).length;

  return Math.max(baseRequests % 1000, relevantCommands); // Use modulo to simulate daily reset
}

/**
 * Log key check results to immutable log
 */
async function logKeyCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  result: KeyCheckResult
): Promise<void> {
  try {
    await supabase.from("immutable_command_log").insert({
      command_text: "CHECK_KEYS_USAGE",
      signature: "system-monitor",
      executor_ip: null,
      executed_at: new Date().toISOString(),
      status: result.warnings.length > 0 ? "warning" : "executed",
      result_summary: `Checked ${result.total_keys} keys, ${result.exhausted_keys.length} exhausted`,
      parameters: {
        total_keys: result.total_keys,
        active_keys: result.active_keys,
        exhausted_count: result.exhausted_keys.length,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    console.warn("[KeyMonitor] Failed to log key check:", error);
  }
}

/**
 * Mask key for display (show first 4 and last 4 chars)
 */
function maskKey(key: string): string {
  if (!key || key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

/**
 * Format key check results for display
 */
export function formatKeyCheckResult(result: KeyCheckResult): string {
  const lines: string[] = [
    `🔍 <b>Key Monitoring Report</b>`,
    ``,
    `Checked at: ${new Date(result.checked_at).toLocaleString()}`,
    ``,
    `<b>Summary:</b>`,
    `• Total Keys: ${result.total_keys}`,
    `• Active Keys: ${result.active_keys}`,
    `• Exhausted Keys: ${result.exhausted_keys.length}`,
  ];

  if (!result.has_usage_data) {
    lines.push(``, `⚠️ <b>لا توجد بيانات استهلاك كافية بعد</b>`);
    lines.push(`سيتم جمع البيانات تلقائياً مع استخدام المفاتيح.`);
  }

  // Show provider breakdown
  if (result.providers.length > 0) {
    lines.push(``, `<b>Providers:</b>`);
    for (const provider of result.providers) {
      const dailyLimit = DAILY_LIMITS[provider.provider] || 1000;
      const usagePercent = (provider.estimated_usage / dailyLimit) * 100;
      const statusIcon = usagePercent >= 90 ? "🔴" : usagePercent >= 70 ? "🟡" : "🟢";
      lines.push(
        `• ${statusIcon} ${provider.provider.toUpperCase()}: ${provider.active_keys} active, ~${provider.estimated_usage} requests (${usagePercent.toFixed(1)}%)`
      );
    }
  }

  if (result.exhausted_keys.length > 0) {
    lines.push(``, `<b>⚠️ Exhausted/Critical Keys:</b>`);
    for (const key of result.exhausted_keys) {
      lines.push(
        `• ${key.provider.toUpperCase()}: ${key.key} (${key.usage_percent}% used, ${key.status})`
      );
    }
  }

  if (result.warnings.length > 0) {
    lines.push(``, `<b>⚠️ Warnings:</b>`);
    for (const warning of result.warnings) {
      lines.push(`• ${warning}`);
    }
  }

  if (result.exhausted_keys.length === 0 && result.warnings.length === 0) {
    lines.push(``, `✅ All keys are healthy!`);
  }

  return lines.join("\n");
}

/**
 * Get a summary of key usage for chat display
 * Simpler format for conversation
 */
export function getKeyUsageSummary(result: KeyCheckResult): string {
  if (result.total_keys === 0) {
    return "❌ لا توجد مفاتيح API مُنشأة. استخدم `add_key` لإضافة مفاتيح.";
  }

  const lines: string[] = [
    `📊 <b>حالة المفاتيح</b>`,
    ``,
    `<b>المزودون:</b>`,
  ];

  for (const provider of result.providers) {
    const dailyLimit = DAILY_LIMITS[provider.provider] || 1000;
    const usagePercent = (provider.estimated_usage / dailyLimit) * 100;
    const statusIcon = usagePercent >= 90 ? "🔴" : usagePercent >= 70 ? "🟡" : "🟢";

    lines.push(
      `${statusIcon} <b>${provider.provider.toUpperCase()}</b>: ` +
      `${provider.active_keys} نشط | ` +
      `~${provider.estimated_usage} طلب`
    );
  }

  if (result.exhausted_keys.length > 0) {
    lines.push(``, `⚠️ <b>مفاتيح قاربة على النفاد:</b>`);
    for (const key of result.exhausted_keys) {
      lines.push(`• ${key.provider}: ${key.usage_percent}%`);
    }
  }

  if (!result.has_usage_data) {
    lines.push(``, `ℹ️ لا توجد بيانات استهلاك بعد - سيتم التحديث تلقائياً.`);
  }

  lines.push(``, `استخدم <code>check_keys</code> لتحديث العرض.`);

  return lines.join("\n");
}

/**
 * Add a backup key to the pool
 */
export async function addBackupKey(
  provider: string,
  key: string
): Promise<{ success: boolean; message: string; keyId?: string }> {
  try {
    // Using centralized supabase singleton

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        provider: provider.toLowerCase(),
        key: key,
        is_active: false, // Inactive by default
        total_requests: 0,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { success: false, message: "Key already exists" };
      }
      return { success: false, message: `Failed to add backup key: ${error.message}` };
    }

    // Log the action
    await supabase.from("immutable_command_log").insert({
      command_text: `ADD_BACKUP_KEY: ${provider}`,
      signature: "manual",
      executor_ip: null,
      executed_at: new Date().toISOString(),
      status: "executed",
      result_summary: `Added backup key ${data.id} for ${provider}`,
      parameters: { provider, key_id: data.id },
    });

    return {
      success: true,
      message: `Backup key added for ${provider}`,
      keyId: data.id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Activate a backup key when the primary key is critical/exhausted
 */
async function activateBackupKey(
  supabase: Awaited<ReturnType<typeof createClient>>,
  provider: string,
  exhaustedKeyId: string
): Promise<boolean> {
  try {
    console.log(`[KeyMonitor] Looking for backup key for ${provider}...`);

    // Find an inactive backup key for this provider
    const { data: backupKeys, error } = await supabase
      .from("api_keys")
      .select("id, key, provider, is_backup")
      .eq("provider", provider)
      .eq("is_active", false)
      .eq("is_backup", true)
      .limit(1);

    if (error || !backupKeys || backupKeys.length === 0) {
      console.log(`[KeyMonitor] No backup key available for ${provider}`);
      return false;
    }

    const backupKey = backupKeys[0];

    // Activate the backup key
    const { error: updateError } = await supabase
      .from("api_keys")
      .update({
        is_active: true,
        is_backup: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", backupKey.id);

    if (updateError) {
      console.error("[KeyMonitor] Failed to activate backup key:", updateError);
      return false;
    }

    // Deactivate the exhausted key
    await supabase
      .from("api_keys")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", exhaustedKeyId);

    // Log to immutable command log
    await supabase.from("immutable_command_log").insert({
      command_text: "AUTO_ACTIVATE_BACKUP_KEY",
      signature: "system-monitor",
      executor_ip: null,
      executed_at: new Date().toISOString(),
      status: "executed",
      result_summary: `Activated backup key ${backupKey.id} for ${provider}, deactivated exhausted key ${exhaustedKeyId}`,
      parameters: {
        provider,
        exhausted_key_id: exhaustedKeyId,
        backup_key_id: backupKey.id,
        action: "auto_activation",
      },
    });

    // Send notification
    await sendSecurityAlert(
      `✅ <b>Backup Key Activated</b>\n\n` +
      `Provider: ${provider.toUpperCase()}\n` +
      `Exhausted Key: ${exhaustedKeyId}\n` +
      `New Active Key: ${backupKey.id}\n\n` +
      `🔄 Automatic failover completed successfully!`
    );

    console.log(`[KeyMonitor] Backup key ${backupKey.id} activated for ${provider}`);
    return true;
  } catch (error) {
    console.error("[KeyMonitor] Error activating backup key:", error);
    return false;
  }
}

/**
 * Start automatic key monitoring at regular intervals
 */
let monitoringInterval: NodeJS.Timeout | null = null;

export function startKeyMonitoring(intervalMinutes: number = 60): void {
  const isMonitoringEnabled = process.env.ENABLE_KEY_MONITORING !== "false";

  if (!isMonitoringEnabled) {
    console.log("[KeyMonitor] Auto monitoring disabled (ENABLE_KEY_MONITORING=false)");
    return;
  }

  // Stop existing interval if any
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[KeyMonitor] Starting automatic monitoring every ${intervalMinutes} minute(s)...`);
  console.log(`[KeyMonitor] Warning threshold: ${process.env.KEY_USAGE_WARNING_PERCENT || 80}%`);
  console.log(`[KeyMonitor] Critical threshold: ${process.env.KEY_USAGE_CRITICAL_PERCENT || 95}%`);

  // Run initial check
  checkKeysUsage().catch(err => console.error("[KeyMonitor] Initial check failed:", err));

  // Set up recurring monitoring
  monitoringInterval = setInterval(async () => {
    console.log(`[KeyMonitor] Running scheduled check at ${new Date().toISOString()}`);
    try {
      await checkKeysUsage();
    } catch (error) {
      console.error("[KeyMonitor] Scheduled check failed:", error);
    }
  }, intervalMs);
}

/**
 * Stop automatic key monitoring
 */
export function stopKeyMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log("[KeyMonitor] Automatic monitoring stopped");
  }
}

/**
 * Check if automatic monitoring is active
 */
export function isKeyMonitoringActive(): boolean {
  return monitoringInterval !== null;
}
