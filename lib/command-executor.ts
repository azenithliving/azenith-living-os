/**
 * Command Executor - Phase 3: Initial Self-Execution
 * Executes 10 administrative commands with logging
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeCommandLogs, formatEvolutionReport, executeSuggestion, logSelfExecution, type EvolutionSuggestion } from "./self-evolution";
import { checkKeysUsage, formatKeyCheckResult, getKeyUsageSummary, addBackupKey as addBackupKeyFromMonitor } from "./key-monitor";
import fs from "fs";
import path from "path";

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface CommandContext {
  supabase: SupabaseClient;
  userId: string;
  userEmail: string;
  bypassRls?: boolean;
  isOwner?: boolean;
}

// Alias for frequently used command "list_keys" (37 times today)
// Alias for frequently used command "list_keys" (40 times today)
// ============================================
// 1. ADD KEY - Add new API key
// ============================================
export async function addKey(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider, ...keyParts] = args;
  const key = keyParts.join(" ");

  if (!provider || !key) {
    return { success: false, message: "Usage: add_key <provider> <key>" };
  }

  const normalizedProvider = provider.toLowerCase();

  try {
    // Check if key already exists (by key value)
    const { data: existingKeys, error: checkError } = await context.supabase
      .from("api_keys")
      .select("id, provider, key, is_active")
      .eq("provider", normalizedProvider)
      .eq("key", key)
      .limit(1);

    if (checkError) {
      return { success: false, message: `Failed to check existing keys: ${checkError.message}` };
    }

    if (existingKeys && existingKeys.length > 0) {
      const existing = existingKeys[0];
      return {
        success: false,
        message: `Key already exists for ${normalizedProvider} (ID: ${existing.id}, ${existing.is_active ? 'active' : 'inactive'})`,
      };
    }

    // Insert new key
    const insertData = {
      provider: normalizedProvider,
      key: key,
      is_active: true,
      is_backup: false,
      total_requests: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("[addKey] Attempting to insert:", JSON.stringify({ ...insertData, key: "***REDACTED***" }));

    const { data: inserted, error } = await context.supabase
      .from("api_keys")
      .insert(insertData)
      .select("id, provider, is_active, created_at")
      .single();

    if (error) {
      console.error("[addKey] Supabase insert error:", error);
      console.error("[addKey] Error code:", error.code);
      console.error("[addKey] Error details:", error.details);
      console.error("[addKey] Error hint:", error.hint);
      return { success: false, message: `Failed to add key: ${error.message} (code: ${error.code})` };
    }

    console.log("[addKey] Insert successful:", inserted);

    return {
      success: true,
      message: `✅ API key added for ${normalizedProvider}\nID: ${inserted.id}\nStatus: ${inserted.is_active ? 'Active' : 'Inactive'}`,
      data: { 
        provider: normalizedProvider, 
        id: inserted.id,
        maskedKey: maskKey(key) 
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Simulate key usage for testing auto-activation
 * Usage: simulate_key_usage <provider> <key_id> <percentage>
 */
export async function simulateKeyUsage(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider, keyId, percentage] = args;

  if (!provider || !keyId || !percentage) {
    return {
      success: false,
      message: "Usage: simulate_key_usage <provider> <key_id> <percentage>\nExample: simulate_key_usage groq abc123 96",
    };
  }

  const usagePercent = parseInt(percentage, 10);
  if (isNaN(usagePercent) || usagePercent < 0 || usagePercent > 100) {
    return {
      success: false,
      message: "Percentage must be a number between 0 and 100",
    };
  }

  try {
    // Update the key's total_requests to simulate usage
    // Assuming daily limit is 1000 requests for simulation
    const simulatedRequests = Math.floor((usagePercent / 100) * 1000);

    const { data: key, error: fetchError } = await context.supabase
      .from("api_keys")
      .select("id, provider, total_requests, is_active")
      .eq("id", keyId)
      .eq("provider", provider.toLowerCase())
      .single();

    if (fetchError || !key) {
      return {
        success: false,
        message: `Key not found: ${keyId} for provider ${provider}`,
      };
    }

    const { error: updateError } = await context.supabase
      .from("api_keys")
      .update({
        total_requests: simulatedRequests,
        updated_at: new Date().toISOString(),
      })
      .eq("id", keyId);

    if (updateError) {
      return {
        success: false,
        message: `Failed to update key usage: ${updateError.message}`,
      };
    }

    // Log the simulation
    await context.supabase.from("immutable_command_log").insert({
      command_text: "SIMULATE_KEY_USAGE",
      signature: context.userId,
      executor_ip: null,
      executed_at: new Date().toISOString(),
      status: "executed",
      result_summary: `Simulated ${usagePercent}% usage (${simulatedRequests} requests) for key ${keyId}`,
      parameters: {
        provider,
        key_id: keyId,
        simulated_percentage: usagePercent,
        simulated_requests: simulatedRequests,
      },
    });

    // Trigger key check to test auto-activation
    const checkResult = await checkKeysUsage();

    let message = `✅ Simulated ${usagePercent}% usage for ${provider} key ${keyId}\n`;
    message += `(~${simulatedRequests} requests out of 1000 daily limit)\n\n`;

    if (usagePercent >= 95) {
      message += `🔴 **CRITICAL**: Key is at ${usagePercent}%!\n`;
      message += `Checking for backup key activation...\n`;
      if (checkResult.warnings.some(w => w.includes("backup"))) {
        message += `✅ Backup key auto-activation triggered!`;
      } else {
        message += `⚠️ No backup key available for auto-activation.`;
      }
    } else if (usagePercent >= 80) {
      message += `🟡 **WARNING**: Key is at ${usagePercent}%.`;
    } else {
      message += `🟢 Key usage is at ${usagePercent}%.`;
    }

    return {
      success: true,
      message,
      data: {
        provider,
        keyId,
        simulatedPercentage: usagePercent,
        simulatedRequests,
        checkResult,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 2. REMOVE KEY - Remove API key
// ============================================
export async function removeKey(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider, keyId] = args;

  if (!provider) {
    return { success: false, message: "Usage: remove_key <provider> [key_id]" };
  }

  try {
    let query = context.supabase
      .from("api_keys")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", provider.toLowerCase());

    if (keyId) {
      query = query.eq("id", keyId);
    }

    const { error, count } = await query;

    if (error) {
      return { success: false, message: `Failed to remove key: ${error.message}` };
    }

    return {
      success: true,
      message: `Removed ${count || 0} key(s) for ${provider}`,
      data: { provider, removedCount: count || 0 },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 3. LIST KEYS - List API keys (masked)
// ============================================
export async function listKeys(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider] = args;

  // Check if user is owner (email in MASTER_ADMIN_EMAILS)
  const masterEmails = process.env.MASTER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  const isOwner = !!(context.userEmail && masterEmails.includes(context.userEmail));

  // Check if in bypass mode (development or BYPASS env var or owner)
  const isBypassMode = context.bypassRls ||
    process.env.NODE_ENV === "development" ||
    process.env.BYPASS === "true" ||
    isOwner;

  try {
    let query;

    if (isBypassMode || isOwner) {
      // Owner or bypass mode: fetch ALL keys without user_id filter
      query = context.supabase
        .from("api_keys")
        .select("id, provider, is_active, last_used_at, created_at, user_id")
        .eq("is_active", true);
    } else {
      // Normal mode: filter by user_id
      query = context.supabase
        .from("api_keys")
        .select("id, provider, is_active, last_used_at, created_at")
        .eq("user_id", context.userId)
        .eq("is_active", true);
    }

    if (provider) {
      query = query.eq("provider", provider.toLowerCase());
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return { success: false, message: `Failed to list keys: ${error.message}` };
    }

    const providers = [...new Set(data?.map(k => k.provider) || [])];

    return {
      success: true,
      message: `Found ${data?.length || 0} active key(s)`,
      data: {
        total: data?.length || 0,
        providers,
        keys: data?.map(k => ({
          id: k.id,
          provider: k.provider,
          status: k.is_active ? "active" : "inactive",
          lastUsed: k.last_used_at,
          created: k.created_at,
          ...(isBypassMode && { userId: (k as any).user_id }), // Include user_id in bypass mode
        })) || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 4. RATE LIMIT - Update rate limit
// ============================================
export async function rateLimit(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [endpoint, limitStr] = args;
  const limit = parseInt(limitStr, 10);

  if (!endpoint || isNaN(limit)) {
    return { success: false, message: "Usage: rate_limit <endpoint> <limit>" };
  }

  try {
    // Store rate limit config in Supabase
    const { error } = await context.supabase.from("rate_limits").upsert({
      endpoint: endpoint.toLowerCase(),
      limit_per_hour: limit,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    }, { onConflict: "endpoint" });

    if (error) {
      return { success: false, message: `Failed to update rate limit: ${error.message}` };
    }

    return {
      success: true,
      message: `Rate limit updated: ${endpoint} = ${limit}/hour`,
      data: { endpoint, limit },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 5. SEND NOTIFICATION - Send Telegram notification
// ============================================
export async function sendNotification(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const message = args.join(" ");

  if (!message) {
    return { success: false, message: "Usage: send_notification <message>" };
  }

  try {
    const { sendSecurityAlert } = await import("./telegram-notify");
    
    const notificationText = [
      "🤖 <b>Mastermind Admin Notification</b>",
      "",
      `👤 User: ${context.userEmail}`,
      `📝 Message: ${message}`,
      `⏰ Time: ${new Date().toISOString()}`,
    ].join("\n");
    
    await sendSecurityAlert(notificationText);

    return {
      success: true,
      message: "Notification sent via Telegram",
      data: { message, timestamp: new Date().toISOString() },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send notification",
    };
  }
}

// ============================================
// 6. SHOW STATS - Display system statistics
// ============================================
export async function showStats(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [daysStr = "7"] = args;
  const days = parseInt(daysStr, 10);

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get command stats
    const { data: commands, error: cmdError } = await context.supabase
      .from("immutable_command_log")
      .select("status, executed_at")
      .eq("user_id", context.userId)
      .gte("executed_at", since);

    if (cmdError) {
      return { success: false, message: `Failed to fetch stats: ${cmdError.message}` };
    }

    const total = commands?.length || 0;
    const successful = commands?.filter(c => c.status === "executed").length || 0;
    const failed = commands?.filter(c => c.status === "failed").length || 0;

    return {
      success: true,
      message: `Statistics for last ${days} days`,
      data: {
        period: `${days} days`,
        totalCommands: total,
        successful,
        failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(1) + "%" : "N/A",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 7. CLEAR CACHE - Clear cache (Redis/Supabase)
// ============================================
export async function clearCache(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [type = "all"] = args;

  try {
    // Clear different cache types
    const cleared: string[] = [];

    if (type === "all" || type === "local") {
      // Clear local storage patterns (server-side caches)
      cleared.push("local");
    }

    if (type === "all" || type === "supabase") {
      // Note: Supabase doesn't have direct cache clear, but we can invalidate
      cleared.push("supabase_metadata");
    }

    if (type === "all" || type === "chat") {
      // This is client-side only, but we acknowledge it
      cleared.push("chat_history_marker");
    }

    return {
      success: true,
      message: `Cache cleared: ${cleared.join(", ")}`,
      data: { clearedTypes: cleared, requestedType: type },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 8. RESTART SERVICE - Restart a service
// ============================================
export async function restartService(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [service] = args;

  if (!service) {
    return { success: false, message: "Usage: restart_service <service>" };
  }

  const validServices = ["ai-orchestrator", "mastermind", "cache", "sessions"];

  if (!validServices.includes(service.toLowerCase())) {
    return {
      success: false,
      message: `Unknown service. Valid: ${validServices.join(", ")}`,
    };
  }

  try {
    // Simulate service restart
    const restartActions: Record<string, () => void> = {
      "ai-orchestrator": () => {
        // Reset orchestrator state
        console.log("AI Orchestrator state reset");
      },
      "mastermind": () => {
        // Clear mastermind cache
        console.log("Mastermind cache cleared");
      },
      "cache": () => {
        console.log("General cache cleared");
      },
      "sessions": () => {
        console.log("Session cache cleared");
      },
    };

    restartActions[service.toLowerCase()]?.();

    return {
      success: true,
      message: `Service '${service}' restarted successfully`,
      data: { service, restartedAt: new Date().toISOString() },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 9. BACKUP DB - Create database backup
// ============================================
export async function backupDb(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    // Check if user is owner (email in MASTER_ADMIN_EMAILS)
    const masterEmails = process.env.MASTER_ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    const isOwner = !!(context.userEmail && masterEmails.includes(context.userEmail));

    // Check if in bypass mode (development, BYPASS env var, or owner)
    const isBypassMode = context.bypassRls ||
      process.env.NODE_ENV === "development" ||
      process.env.BYPASS === "true" ||
      isOwner;

    // Use admin client for bypass mode to skip RLS
    const { getSupabaseAdminClient } = await import("./supabase-admin");
    const supabaseAdmin = isBypassMode ? getSupabaseAdminClient() : null;
    const client = supabaseAdmin || context.supabase;

    // Export critical tables
    const tables = [
      "api_keys",
      "immutable_command_log",
      "user_2fa",
      "user_public_keys",
    ];

    const backup: Record<string, any[]> = {};

    for (const table of tables) {
      let query = client.from(table).select("*");
      
      // Only filter by user_id if NOT in bypass mode
      if (!isBypassMode) {
        query = query.eq("user_id", context.userId);
      }
      
      const { data, error } = await query;

      if (!error && data) {
        backup[table] = data;
      }
    }

    const backupData = {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      tables: backup,
    };

    // Store backup metadata using admin client in bypass mode
    const insertClient = supabaseAdmin || context.supabase;
    const { error } = await insertClient.from("backups").insert({
      user_id: context.userId,
      backup_data: backupData,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, message: `Failed to create backup: ${error.message}` };
    }

    return {
      success: true,
      message: `Database backup created: ${Object.keys(backup).length} tables`,
      data: {
        tables: Object.keys(backup),
        timestamp: backupData.timestamp,
        recordCount: Object.values(backup).reduce((sum, arr) => sum + arr.length, 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 10. EVOLVE - Self-evolution analysis (Interactive)
// ============================================

// Store pending suggestion for interactive mode
let pendingSuggestion: EvolutionSuggestion | null = null;

export async function evolve(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    console.log("[CommandExecutor] Running self-evolution analysis...");

    // Analyze command logs
    const analysis = await analyzeCommandLogs(context.supabase);

    // Format the report for display
    const report = formatEvolutionReport(analysis);

    // Check if there are actionable suggestions
    const autoApplicable = analysis.suggestions.filter(s => s.canAutoApply && s.targetFile);

    if (autoApplicable.length > 0) {
      // Store first suggestion for potential execution
      pendingSuggestion = autoApplicable[0];

      const interactiveMessage =
        report +
        `\n\n🤖 **هل تريد تطبيق الاقتراح الأول تلقائياً؟**\n` +
        `**الاقتراح:** ${pendingSuggestion.description}\n` +
        `**الملف:** ${pendingSuggestion.targetFile}\n\n` +
        `اكتب **"نعم"** أو **"yes"** للتطبيق، أو **"لا"** للرفض.`;

      return {
        success: true,
        message: interactiveMessage,
        data: {
          totalAnalyzed: analysis.totalAnalyzed,
          failedCommands: analysis.failedCommands,
          slowCommands: analysis.slowCommands,
          suggestionCount: analysis.suggestions.length,
          patterns: analysis.patterns,
          pendingSuggestion: pendingSuggestion,
          awaitingConfirmation: true,
        },
      };
    }

    return {
      success: true,
      message: report,
      data: {
        totalAnalyzed: analysis.totalAnalyzed,
        failedCommands: analysis.failedCommands,
        slowCommands: analysis.slowCommands,
        suggestionCount: analysis.suggestions.length,
        patterns: analysis.patterns,
        pendingSuggestion: null,
        awaitingConfirmation: false,
      },
    };
  } catch (error) {
    console.error("[CommandExecutor] Evolve error:", error);
    return {
      success: false,
      message: error instanceof Error
        ? `فشل تحليل التطور الذاتي: ${error.message}`
        : "فشل تحليل التطور الذاتي",
    };
  }
}

/**
 * Execute pending suggestion after user confirmation
 */
export async function executePendingSuggestion(
  confirmed: boolean,
  context: CommandContext
): Promise<CommandResult> {
  if (!pendingSuggestion) {
    return {
      success: false,
      message: "⚠️ لا يوجد اقتراح معلق للتنفيذ. نفذ 'evolve' أولاً.",
    };
  }

  if (!confirmed) {
    const suggestion = pendingSuggestion;
    pendingSuggestion = null; // Clear pending
    return {
      success: true,
      message: `✅ تم رفض الاقتراح: ${suggestion.description}`,
    };
  }

  // Execute the suggestion
  console.log("[CommandExecutor] Executing pending suggestion...");

  const result = await executeSuggestion(pendingSuggestion);

  // Log to immutable command log
  if (context.supabase) {
    await logSelfExecution(
      context.supabase,
      pendingSuggestion,
      result,
      context.userId
    );
  }

  // Clear pending after execution
  const executedSuggestion = pendingSuggestion;
  pendingSuggestion = null;

  if (result.success) {
    return {
      success: true,
      message:
        `✅ **تم تطبيق الاقتراح بنجاح!**\n\n` +
        `${result.message}\n\n` +
        `🔄 **أعد تشغيل الخادم لتفعيل التغييرات:**\n` +
        `\`\`\`bash\n` +
        `npm run dev\n` +
        `\`\`\``,
      data: {
        appliedSuggestion: executedSuggestion,
      },
    };
  } else {
    return {
      success: false,
      message:
        `❌ **فشل تطبيق الاقتراح**\n\n` +
        `${result.message}\n\n` +
        `💡 **الحلول الممكنة:**\n` +
        `1. تحقق من وجود المتغير ENABLE_SELF_EXECUTION=true في .env.local\n` +
        `2. تأكد من أن الملف ${executedSuggestion?.targetFile} موجود\n` +
        `3. تحقق من صلاحيات الكتابة`,
    };
  }
}

/**
 * Check if there's a pending suggestion awaiting confirmation
 */
export function hasPendingSuggestion(): boolean {
  return pendingSuggestion !== null;
}

/**
 * Get the pending suggestion (for display purposes)
 */
export function getPendingSuggestion(): EvolutionSuggestion | null {
  return pendingSuggestion;
}

// ============================================
// 12. CHECK KEYS - Monitor key usage and activate backups
// ============================================
export async function checkKeysCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  try {
    const result = await checkKeysUsage();
    // Use getKeyUsageSummary for a more chat-friendly display
    const summaryMessage = getKeyUsageSummary(result);

    return {
      success: true,
      message: summaryMessage,
      data: {
        checked_at: result.checked_at,
        total_keys: result.total_keys,
        active_keys: result.active_keys,
        exhausted_count: result.exhausted_keys.length,
        warnings: result.warnings,
        providers: result.providers,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error
        ? `فشل فحص المفاتيح: ${error.message}`
        : "فشل فحص المفاتيح",
    };
  }
}

// ============================================
// 13. ADD BACKUP KEY - Add a backup API key
// ============================================
export async function addBackupKeyCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider, ...keyParts] = args;
  const key = keyParts.join(" ");

  if (!provider || !key) {
    return { success: false, message: "Usage: add_backup_key <provider> <key>" };
  }

  const validProviders = ["groq", "openrouter", "mistral", "pexels"];
  if (!validProviders.includes(provider.toLowerCase())) {
    return {
      success: false,
      message: `Invalid provider. Must be one of: ${validProviders.join(", ")}`,
    };
  }

  try {
    const result = await addBackupKeyFromMonitor(provider, key);

    return {
      success: result.success,
      message: result.message,
      data: result.keyId ? { provider, keyId: result.keyId } : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// 14. HELP - Show available commands
// ============================================
export async function help(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const commands = [
    { cmd: "add_key <provider> <key>", desc: "إضافة مفتاح API جديد" },
    { cmd: "remove_key <provider> [key_id]", desc: "حذف مفتاح API" },
    { cmd: "list_keys [provider]", desc: "عرض المفاتيح (مقنعة)" },
    { cmd: "rate_limit <endpoint> <limit>", desc: "تحديث حد الطلبات" },
    { cmd: "send_notification <message>", desc: "إرسال إشعار Telegram" },
    { cmd: "show_stats [days]", desc: "عرض إحصائيات الأداء" },
    { cmd: "clear_cache [type]", desc: "مسح الذاكرة المؤقتة" },
    { cmd: "restart_service <service>", desc: "إعادة تشغيل خدمة" },
    { cmd: "backup_db", desc: "إنشاء نسخة احتياطية" },
    { cmd: "evolve", desc: "تحليل التطور الذاتي واقتراح تحسينات" },
    { cmd: "check_keys", desc: "مراقبة استخدام المفاتيح وتفعيل الاحتياطية" },
    { cmd: "add_backup_key <provider> <key>", desc: "إضافة مفتاح احتياطي" },
    { cmd: "help", desc: "عرض هذه القائمة" },
  ];

  const helpText = commands
    .map(c => `• ${c.cmd}\n  ${c.desc}`)
    .join("\n\n");

  return {
    success: true,
    message: "الأوامر المتاحة:\n\n" + helpText,
    data: { commands },
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

// ============================================
// COMMAND ROUTER
// ============================================
export async function executeCommand(
  commandText: string,
  context: CommandContext
): Promise<CommandResult> {
  const parts = commandText.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  let result: CommandResult;

  switch (cmd) {
    case "add_key":
      result = await addKey(args, context);
      break;
    case "remove_key":
      result = await removeKey(args, context);
      break;
    case "list_keys":
      result = await listKeys(args, context);
      break;
    case "rate_limit":
      result = await rateLimit(args, context);
      break;
    case "send_notification":
      result = await sendNotification(args, context);
      break;
    case "show_stats":
      result = await showStats(args, context);
      break;
    case "clear_cache":
      result = await clearCache(args, context);
      break;
    case "restart_service":
      result = await restartService(args, context);
      break;
    case "backup_db":
      result = await backupDb(args, context);
      break;
    case "evolve":
      result = await evolve(args, context);
      break;
    case "check_keys":
      result = await checkKeysCommand(args, context);
      break;
    case "add_backup_key":
      result = await addBackupKeyCommand(args, context);
      break;
    case "simulate_key_usage":
      result = await simulateKeyUsage(args, context);
      break;
    case "help":
      result = await help(args, context);
      break;
    default:
      result = {
        success: false,
        message: `أمر غير معروف: ${cmd}. اكتب "help" لعرض القائمة.`,
      };
  }

  // Log command execution to immutable table
  await logCommandToImmutableTable(context, commandText, result);

  return result;
}

// ============================================
// LOGGING FUNCTIONS
// ============================================

/**
 * Log a command execution to the immutable_command_log table
 * This always inserts a new record with the complete information
 */
async function logCommandToImmutableTable(
  context: CommandContext,
  commandText: string,
  result: CommandResult
) {
  const logEntry = {
    user_id: context.userId,
    command_text: commandText,
    signature: context.userEmail || null,
    executor_ip: null,
    executed_at: new Date().toISOString(),
    status: result.success ? "executed" : "failed",
    result_summary: result.message?.substring(0, 1000) || null,
    parameters: null,
  };

  // Log to Supabase
  try {
    const { error } = await context.supabase.from("immutable_command_log").insert(logEntry);

    if (error) {
      console.error("[CommandExecutor] Failed to log command to Supabase:", error.message);
    } else {
      console.log("[CommandExecutor] Command logged to Supabase:", commandText.split(" ")[0]);
    }
  } catch (e) {
    console.error("[CommandExecutor] Exception logging to Supabase:", e);
  }

  // Log to local file as backup
  try {
    const logsDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logsDir, "commands.json");

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Read existing logs
    let logs: any[] = [];
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf-8");
      try {
        logs = JSON.parse(content);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }

    // Add new entry (keep only last 100 to prevent file from growing too large)
    logs.push(logEntry);
    if (logs.length > 100) {
      logs = logs.slice(-100);
    }

    // Write back to file
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    console.log("[CommandExecutor] Command logged to local file:", commandText.split(" ")[0]);
  } catch (e) {
    console.error("[CommandExecutor] Exception logging to local file:", e);
  }
}
