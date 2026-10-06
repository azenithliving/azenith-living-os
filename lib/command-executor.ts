/**
 * Command Executor - Phase 3: Initial Self-Execution
 * Executes 10 administrative commands with logging
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeCommandLogs, formatEvolutionReport, executeSuggestion, logSelfExecution, type EvolutionSuggestion } from "./self-evolution";
import { checkKeysUsage, formatKeyCheckResult, getKeyUsageSummary, addBackupKey as addBackupKeyFromMonitor } from "./key-monitor";
import { readPage, formatPageContent } from "./web-tools";
import { arDigits, arNum } from "@/lib/ops/metricLabels";
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

// ============================================
// API KEYS TABLE INTERFACE
// ============================================
export interface ApiKey {
  id: string;
  provider: string;
  key: string;
  is_active: boolean;
  is_backup?: boolean;
  total_requests?: number;
  last_used_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  cooldown_until?: string | null;
}

// Alias for frequently used command "list_keys" (37 times today)
// Alias for frequently used command "list_keys" (40 times today)

/**
 * What the owner's chat shows when a command's own read fails.
 *
 * The raw driver text used to be returned as the message — a Postgres or Node sentence in English
 * landing in the middle of his Arabic chat, unreadable to him twice over (the words, and the Latin
 * inside them) and impossible to act on. He gets Arabic that names the command; the technical text
 * goes to the server log, which is where an investigation reads it.
 */
function commandFailed(what: string, error?: unknown): string {
  if (error !== undefined) console.error(`[CommandExecutor] ${what}:`, error);
  return `${what} — السجل ما ردّش. التفاصيل التقنية اتسجّلت في سجل السيرفر.`;
}

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
    return { success: false, message: "لازم تقول اسم المزوّد والمفتاح نفسه." };
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
      return { success: false, message: commandFailed("ما قدرناش نتأكد من المفاتيح الموجودة", checkError.message) };
    }

    if (existingKeys && existingKeys.length > 0) {
      const existing = existingKeys[0];
      return {
        success: false,
        message: `عندك مفتاح مسجّل قبل كده لـ${normalizedProvider} (رقم ${arDigits(existing.id)}، ${existing.is_active ? "شغّال" : "موقوف"})`,
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
      return { success: false, message: commandFailed("ما قدرناش نسجّل المفتاح", `${error.message} (code: ${error.code})`) };
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
      message: commandFailed("ما قدرناش نسجّل المفتاح", error),
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
      message: "لازم تقول اسم المزوّد ورقم المفتاح والنسبة — من صفر لمية.",
    };
  }

  const usagePercent = parseInt(percentage, 10);
  if (isNaN(usagePercent) || usagePercent < 0 || usagePercent > 100) {
    return {
      success: false,
      message: "النسبة لازم تكون رقم بين صفر ومية.",
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
        message: `مفيش مفتاح بالمواصفات دي عند ${provider}.`,
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
        message: commandFailed("ما قدرناش نسخّر استخدام المفتاح", updateError.message),
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
      message: commandFailed("ما قدرناش نحسّب استخدام المفتاح", error),
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
    return { success: false, message: "لازم تقول اسم المزوّد، ومختار رقم المفتاح." };
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
      return { success: false, message: commandFailed("ما قدرناش نشيل المفتاح", error) };
    }

    return {
      success: true,
      message: `اشيل ${arNum(count || 0)} مفتاح من ${provider}.`,
      data: { provider, removedCount: count || 0 },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نشيل المفتاح", error),
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
    // Fetch all active keys (like check_keys does)
    let query = context.supabase
      .from("api_keys")
      .select("*")
      .eq("is_active", true);

    if (provider) {
      query = query.eq("provider", provider.toLowerCase());
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return { success: false, message: commandFailed("ما قدرناش نقرا المفاتيح", error) };
    }

    const providers = [...new Set(data?.map(k => k.provider) || [])];

    return {
      success: true,
      message: `عندك ${arNum(data?.length || 0)} مفتاح مسجّل.`,
      data: {
        total: data?.length || 0,
        providers,
        keys: data?.map(k => ({
          id: k.id,
          provider: k.provider,
          status: k.is_active ? "active" : "inactive",
          lastUsed: k.last_used_at,
          created: k.created_at,
          ...(isBypassMode && {
            userId: (k as any).user_id,
            key: maskKey((k as any).key),
            isBackup: (k as any).is_backup || false,
            totalRequests: (k as any).total_requests || 0,
            updatedAt: (k as any).updated_at,
          }),
        })) || [],
      },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نقرا المفاتيح", error),
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
    return { success: false, message: "لازم تقول اسم الصفحة ورقم السقف." };
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
      return { success: false, message: commandFailed("ما قدرناش نضبط سقف الطلبات", error) };
    }

    return {
      success: true,
      message: `سقف الطلبات بقى ${arDigits(limit)} في الساعة لـ${endpoint}.`,
      data: { endpoint, limit },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نضبط سقف الطلبات", error),
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
    return { success: false, message: "اكتب الكلام اللي عايز يوصل للفريق." };
  }

  try {
    const { sendSecurityAlert } = await import("./telegram-notify");
    
    const { telegramAlert, telegramTime } = await import("./telegram-copy");
    const notificationText = telegramAlert("🤖", "إشعار من عقل النظام", [
      ["المستخدم", context.userEmail],
      ["الرسالة", message],
      ["الوقت", telegramTime()],
    ]);
    
    const told = await sendSecurityAlert(notificationText);

    // The command's own answer is whether a human was reached, not whether the code ran: an
    // unconfigured channel used to be reported to him as «Notification sent».
    return {
      success: told,
      message: told
        ? "الإشعار وصل للفريق على تليجرام."
        : "ما قدرناش نبعت الإشعار — قناة التنبيهات مقفولة أو بلا عنوان. راجع إعدادات تليجرام في اللوحة.",
      data: { message, timestamp: new Date().toISOString(), delivered: told },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نبعت الإشعار", error),
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
  const parsed = parseInt(daysStr, 10);
  // A command line typed by a model can carry anything in this slot; a NaN here would reach the
  // store as an impossible date and answer with a driver error instead of his numbers.
  const days = Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : 7;

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get command stats
    const { data: commands, error: cmdError } = await context.supabase
      .from("immutable_command_log")
      .select("status, executed_at")
      .eq("user_id", context.userId)
      .gte("executed_at", since);

    if (cmdError) {
      return { success: false, message: commandFailed("ما قدرناش نقرا إحصائيات الأوامر", cmdError.message) };
    }

    const total = commands?.length || 0;
    const successful = commands?.filter(c => c.status === "executed").length || 0;
    const failed = commands?.filter(c => c.status === "failed").length || 0;
    const rate = total > 0 ? ((successful / total) * 100).toFixed(1) : null;

    /**
     * His sentence, from the rows the log actually holds. It used to answer «Statistics for last 7
     * days» and leave the numbers in a data object his chat never showed — so the one command he
     * asks for a read-out returned a headline with no news in it.
     */
    const period = `آخر ${arNum(days)} يوم`;
    const message =
      total === 0
        ? `${period}: مفيش أمر متسجّل عندك.`
        : `${period}: ${arNum(total)} أمر — ${arNum(successful)} اتنفذ، ${arNum(failed)} وقع${
            rate === null ? "" : `، ونسبة النجاح ${arDigits(rate).replace(".", "٫")}٪`
          }.`;

    return {
      success: true,
      message,
      data: {
        period: `${days} days`,
        totalCommands: total,
        successful,
        failed,
        successRate: rate === null ? "N/A" : `${rate}%`,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نقرا إحصائيات الأوامر", error),
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
      success: false,
      message:
        "المتجر ما بينضّفش الذاكرة المؤقتة من الشات — هي بتتغيّر لوحدها مع كل نسخة جديدة تنزل. الطلب اتسجّل بس.",
      data: { clearedTypes: cleared, requestedType: type },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش ننضّف الذاكرة المؤقتة", error),
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
    return { success: false, message: "لازم تقول اسم الخدمة." };
  }

  const validServices = ["ai-orchestrator", "mastermind", "cache", "sessions"];

  if (!validServices.includes(service.toLowerCase())) {
    return {
      success: false,
      message: `«${service}» مش من خدمات المتجر المعروفة.`,
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
      success: false,
      message:
        `المتجر ما بيعيدش تشغيل خدمة من الشات — اللي بيحدّث الخدمة فعلًا هو نزول نسخة جديدة. قول «انشر» وده بيحصل.`,
      data: { service, restartedAt: new Date().toISOString() },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نعيد تشغيل الخدمة", error),
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
      return { success: false, message: commandFailed("ما قدرناش نعمل نسخة احتياطية", error) };
    }

    return {
      success: true,
      message: `النسخة الاحتياطية اتعملت من ${arNum(Object.keys(backup).length)} جدول.`,
      data: {
        tables: Object.keys(backup),
        timestamp: backupData.timestamp,
        recordCount: Object.values(backup).reduce((sum, arr) => sum + arr.length, 0),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نعمل نسخة احتياطية", error),
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

    const { isVercelProduction } = await import("./admin-cloud-evolution");
    if (isVercelProduction() || args.includes("pr") || args.includes("cloud")) {
      const { executeProjectEvolutionMission } = await import("./admin-project-evolver");
      const mission =
        args.filter((a) => !/^(pr|cloud)$/i.test(a)).join(" ") ||
        "تحسين المشروع من سجل الأوامر";
      const prResult = await executeProjectEvolutionMission(mission, {
        userId: context.userId,
      });
      if (prResult.success) {
        return {
          success: true,
          message: prResult.message,
          data: {
            prUrl: prResult.prUrl,
            mode: "project_evolution",
            details: prResult.data,
          },
        };
      }
    }

    // Analyze command logs
    const analysis = await analyzeCommandLogs(context.supabase);

    // Format the report for display
    const report = formatEvolutionReport(analysis);

    // Check if there are actionable suggestions
    const autoApplicable = analysis.suggestions.filter(s => s.canAutoApply && s.targetFile);

    if (autoApplicable.length > 0) {
      // Store first suggestion for potential execution
      pendingSuggestion = autoApplicable[0];

      const { isVercelProduction } = await import("./admin-cloud-evolution");
      const cloudNote = isVercelProduction()
        ? "\n\n☁️ على Vercel: التطبيق يمر عبر **عقل النظام** (موافقة + PR اختياري) — ليس حظراً."
        : "";

      const interactiveMessage =
        report +
        `\n\n🤖 **هل تريد تطبيق الاقتراح الأول؟**\n` +
        `**الاقتراح:** ${pendingSuggestion.description}\n` +
        `**الملف:** ${pendingSuggestion.targetFile}\n\n` +
        `اكتب **"نعم"** أو **"yes"** للتطبيق، أو **"لا"** للرفض.` +
        cloudNote;

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
// 13. SEARCH - Search the web using DuckDuckGo (DISABLED)
// ============================================
export async function searchCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  return {
    success: false,
    message: "🔍 تم إيقاف خدمة البحث مؤقتاً. يمكنك استخدام 'read <رابط>' لقراءة أي صفحة ويب.",
  };
}

// ============================================
// 14. READ - Read and summarize a web page
// ============================================
export async function readCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const url = args[0];

  if (!url) {
    return {
      success: false,
      message: "استخدم: read <رابط>\nمثال: read https://example.com/article",
    };
  }

  try {
    const result = await readPage(url);

    if (!result.success || !result.content) {
      return {
        success: false,
        message: result.message || "فشل قراءة الصفحة",
      };
    }

    const formattedContent = formatPageContent(result.title || "No title", result.content);

    return {
      success: true,
      message: formattedContent,
      data: {
        url,
        title: result.title,
        content_length: result.content.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: commandFailed("ما قدرناش نقرا الصفحة", error),
    };
  }
}

// ============================================
// 15. ADD BACKUP KEY - Add a backup API key
// ============================================
export async function addBackupKeyCommand(
  args: string[],
  context: CommandContext
): Promise<CommandResult> {
  const [provider, ...keyParts] = args;
  const key = keyParts.join(" ");

  if (!provider || !key) {
    return { success: false, message: "لازم تقول اسم المزوّد والمفتاح الاحتياطي." };
  }

  const validProviders = ["groq", "openrouter", "mistral", "pexels"];
  if (!validProviders.includes(provider.toLowerCase())) {
    return {
      success: false,
      message: `«${provider}» مش من المزوّدين اللي عندنا.`,
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
      message: commandFailed("ما قدرناش نضيف المفتاح الاحتياطي", error),
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
    { cmd: "read <url>", desc: "قراءة وملخص محتوى صفحة ويب" },
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
    case "search":
      result = { success: false, message: "� تم إيقاف خدمة البحث مؤقتاً. يمكنك استخدام 'read <رابط>' لقراءة أي صفحة ويب." };
      break;
    case "read":
      result = await readCommand(args, context);
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
    // The desk belongs to a signed-in admin. The natural brain's fallback id is a synthetic
    // all-zeros UUID that exists in no user table, and the foreign key here rejects it outright —
    // so an unattributed command is written with no owner rather than lost.
    user_id: context.userId && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(context.userId) ? context.userId : null,
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
    // A serverless function has a read-only code directory, so this backup cannot exist there. The
    // record is printed as one greppable audit line instead of vanishing behind an exception: the
    // platform log is then the trail, and nobody has to guess whether the backup ever worked.
    console.warn("[CommandExecutor] local backup unavailable:", (e as Error)?.message);
    console.log(`[CommandAudit] ${JSON.stringify(logEntry)}`);
  }
}
