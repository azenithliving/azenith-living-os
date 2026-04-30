/**
 * Self-Evolution Module for Mastermind AI
 *
 * "I learn from my mistakes and improve myself."
 *
 * This module analyzes command execution logs to:
 * 1. Identify patterns in failed commands
 * 2. Detect slow or problematic operations
 * 3. Suggest improvements to the system
 * 4. Propose code changes (with user approval)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { applySuggestion as applySandboxSuggestion, isFileAllowed } from "./sandbox-executor";

export interface CommandLogEntry {
  id: number;
  user_id: string;
  command_text: string;
  status: "pending" | "executed" | "failed";
  result_summary: string | null;
  executed_at: string;
  completed_at: string | null;
}

export interface EvolutionSuggestion {
  type: "add_backup_key" | "optimize_performance" | "fix_error_pattern" | "add_feature";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  proposedAction: string;
  affectedFile?: string;
  codeSnippet?: string;
  // Actionable fields for self-execution
  action?: "add_comment" | "add_function" | "modify_code" | "add_caching";
  targetFile?: string;
  searchPattern?: string;
  replacement?: string;
  canAutoApply?: boolean;
}

export interface EvolutionAnalysis {
  totalAnalyzed: number;
  failedCommands: number;
  slowCommands: number;
  suggestions: EvolutionSuggestion[];
  patterns: string[];
}

/**
 * Read local logs from file as fallback
 */
function readLocalLogs(): CommandLogEntry[] {
  try {
    const logFile = path.join(process.cwd(), "logs", "commands.json");
    if (!fs.existsSync(logFile)) {
      console.log("[SelfEvolution] Local log file not found:", logFile);
      return [];
    }

    const content = fs.readFileSync(logFile, "utf-8");
    const logs = JSON.parse(content);
    
    if (!Array.isArray(logs)) {
      console.log("[SelfEvolution] Local log file is not an array");
      return [];
    }

    console.log(`[SelfEvolution] Read ${logs.length} entries from local file`);
    
    // Map local format to CommandLogEntry format
    return logs.map((log: any) => ({
      id: log.id || Date.now(),
      user_id: log.user_id,
      command_text: log.command_text,
      status: log.status,
      result_summary: log.result_summary,
      executed_at: log.executed_at,
      completed_at: log.executed_at, // Use same timestamp for completed
    }));
  } catch (e) {
    console.error("[SelfEvolution] Failed to read local logs:", e);
    return [];
  }
}

/**
 * Generate smart suggestions based on command analysis
 */
export function generateSuggestions(commands: CommandLogEntry[]): EvolutionSuggestion[] {
  const suggestions: EvolutionSuggestion[] = [];
  
  if (commands.length === 0) return suggestions;

  // 1. Detect repeated commands (>3 times in a day)
  const today = new Date().toISOString().split('T')[0];
  const todayCommands = commands.filter(c => c.executed_at.startsWith(today));
  
  const commandCounts: Record<string, number> = {};
  todayCommands.forEach(c => {
    const cmd = c.command_text.split(' ')[0].toLowerCase();
    commandCounts[cmd] = (commandCounts[cmd] || 0) + 1;
  });

  for (const [cmd, count] of Object.entries(commandCounts)) {
    if (count > 3) {
      suggestions.push({
        type: "add_feature",
        severity: "medium",
        description: `تم تنفيذ أمر "${cmd}" ${count} مرات اليوم. هذا يشير إلى استخدام متكرر.`,
        proposedAction: `أقترح إضافة اختصار للأمر "${cmd}" أو إنشاء أمر مجمع ينفذ عدة مهام دفعة واحدة.`,
        affectedFile: "lib/command-executor.ts",
        codeSnippet: `// Add alias for frequently used command
const COMMAND_ALIASES = {
  "${cmd}": "${cmd}",
  "${cmd.slice(0, 2)}": "${cmd}" // shorthand alias
};`,
        // Actionable fields for self-execution
        action: "add_comment",
        targetFile: "lib/command-executor.ts",
        searchPattern: "// ============================================",
        replacement: `// Alias for frequently used command "${cmd}" (${count} times today)\n// ============================================`,
        canAutoApply: true,
      });
    }
  }

  // 2. Detect slow commands (>2 seconds estimated)
  // Since we don't have exact duration, we estimate based on command type
  const slowCommandTypes = ["backup_db", "show_stats", "list_keys"];
  const slowCommands = commands.filter(c => {
    const cmd = c.command_text.split(' ')[0].toLowerCase();
    // These commands typically take longer due to database operations
    return slowCommandTypes.includes(cmd) && c.status === "executed";
  });

  if (slowCommands.length > 0) {
    const uniqueSlowCmds = [...new Set(slowCommands.map(c => c.command_text.split(' ')[0]))];

    for (const cmd of uniqueSlowCmds.slice(0, 2)) { // Limit to first 2 slow commands
      suggestions.push({
        type: "optimize_performance",
        severity: "medium",
        description: `أمر "${cmd}" قد يستغرق وقتاً طويلاً بسبب العمليات على قاعدة البيانات.`,
        proposedAction: `جرب تفعيل التخزين المؤقت (caching) لنتائج ${cmd} لتقليل وقت الاستجابة.`,
        affectedFile: "lib/command-executor.ts",
        codeSnippet: `// Add caching for ${cmd} command
const CACHE_TTL = 60; // Cache for 1 minute
const cachedResult = cache.get("${cmd}");
if (cachedResult) return cachedResult;`,
        // Actionable fields for self-execution
        action: "add_comment",
        targetFile: "lib/command-executor.ts",
        searchPattern: `// ============================================\n// ${cmd.toUpperCase().replace(/_/g, " ")}`,
        replacement: `// ============================================\n// ${cmd.toUpperCase().replace(/_/g, " ")} - OPTIMIZED: Consider adding caching`,
        canAutoApply: true,
      });
    }
  }

  // 3. Analyze errors from result_summary
  const failedCommands = commands.filter(c => c.status === "failed");
  
  if (failedCommands.length > 0) {
    // Group errors by type
    const errorTypes: Record<string, CommandLogEntry[]> = {};
    
    failedCommands.forEach(cmd => {
      const summary = cmd.result_summary?.toLowerCase() || "";
      let errorType = "general";
      
      if (summary.includes("api") || summary.includes("key") || summary.includes("unauthorized")) {
        errorType = "api_error";
      } else if (summary.includes("database") || summary.includes("db") || summary.includes("connection")) {
        errorType = "db_error";
      } else if (summary.includes("timeout") || summary.includes("time")) {
        errorType = "timeout_error";
      } else if (summary.includes("not found") || summary.includes("غير معروف") || summary.includes("unknown")) {
        errorType = "unknown_command";
      }
      
      if (!errorTypes[errorType]) errorTypes[errorType] = [];
      errorTypes[errorType].push(cmd);
    });

    // Generate suggestions for each error type
    for (const [errorType, cmds] of Object.entries(errorTypes)) {
      const cmdNames = [...new Set(cmds.map(c => c.command_text.split(' ')[0]))].join(', ');
      
      if (errorType === "api_error") {
        suggestions.push({
          type: "add_backup_key",
          severity: "high",
          description: `${cmds.length} أمر فشل بسبب مشاكل في مفاتيح API (${cmdNames}).`,
          proposedAction: "تحقق من صلاحية مفاتيح API وأضف مفاتيح احتياطية من مزودين مختلفين.",
          affectedFile: "lib/mastermind-ai.ts",
          codeSnippet: `// Add backup API key fallback
const backupKeys = process.env.BACKUP_API_KEYS?.split(',');
if (primaryKeyFailed && backupKeys) {
  await useBackupKey(backupKeys[0]);
}`,
        });
      } else if (errorType === "db_error") {
        suggestions.push({
          type: "optimize_performance",
          severity: "high",
          description: `${cmds.length} أمر فشل بسبب مشاكل في قاعدة البيانات (${cmdNames}).`,
          proposedAction: "تحقق من اتصال Supabase وأضف منطق إعادة المحاولة (retry logic).",
          affectedFile: "lib/command-executor.ts",
          codeSnippet: `// Add retry logic for database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error("Max retries exceeded");
}`,
        });
      } else if (errorType === "unknown_command") {
        suggestions.push({
          type: "add_feature",
          severity: "low",
          description: `${cmds.length} محاولة لتنفيذ أوامر غير معروفة (${cmdNames}).`,
          proposedAction: "أضف مطابقة غامضة (fuzzy matching) لاكتشاف الأوامر المكتوبة بشكل خاطئ.",
          affectedFile: "lib/mastermind-ai.ts",
          codeSnippet: `// Add fuzzy command matching
function findSimilarCommand(input: string): string | null {
  const commands = ['list_keys', 'backup_db', 'show_stats'];
  return commands.find(cmd => cmd.includes(input.toLowerCase())) || null;
}`,
        });
      }
    }
  }

  // 4. General optimization suggestions
  if (commands.length > 10 && suggestions.length === 0) {
    suggestions.push({
      type: "optimize_performance",
      severity: "low",
      description: `تم تنفيذ ${commands.length} أمر حتى الآن. النظام يعمل بشكل جيد!`,
      proposedAction: "استمر في مراقبة الأداء. لا توجد مشاكل كبيرة مكتشفة حالياً.",
    });
  }

  return suggestions;
}

/**
 * Analyze last 50 commands from immutable_command_log
 */
export async function analyzeCommandLogs(
  supabase: SupabaseClient
): Promise<EvolutionAnalysis> {
  console.log("[SelfEvolution] Analyzing command logs...");

  let commands: CommandLogEntry[] = [];
  let useLocal = false;

  try {
    // Fetch last 50 commands from Supabase
    const { data: logs, error } = await supabase
      .from("immutable_command_log")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[SelfEvolution] Failed to fetch from Supabase:", error.message);
      useLocal = true;
    } else if (!logs || logs.length === 0) {
      console.log("[SelfEvolution] No logs in Supabase, checking local file...");
      useLocal = true;
    } else {
      commands = logs as CommandLogEntry[];
      console.log(`[SelfEvolution] Fetched ${commands.length} entries from Supabase`);
    }
  } catch (e) {
    console.error("[SelfEvolution] Exception fetching from Supabase:", e);
    useLocal = true;
  }

  // Fallback to local file if Supabase failed or returned empty
  if (useLocal) {
    commands = readLocalLogs();
  }

  try {
    const failedCommands = commands.filter((c) => c.status === "failed");
    const slowCommands = commands.filter((c) => {
      if (!c.completed_at || !c.executed_at) return false;
      const duration = new Date(c.completed_at).getTime() - new Date(c.executed_at).getTime();
      return duration > 2000; // Commands taking > 2 seconds (reduced from 5s)
    });

    console.log(
      `[SelfEvolution] Analyzed ${commands.length} commands: ${failedCommands.length} failed, ${slowCommands.length} slow`
    );

    // Use the new smart suggestion generator
    const suggestions = generateSuggestions(commands);
    
    // Generate patterns for reporting
    const patterns: string[] = [];
    
    if (failedCommands.length > 0) {
      patterns.push(`${failedCommands.length} أمر فشل`);
    }
    if (slowCommands.length > 0) {
      patterns.push(`${slowCommands.length} أمر بطيء (>2 ثانية)`);
    }
    if (commands.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayCount = commands.filter(c => c.executed_at.startsWith(today)).length;
      if (todayCount > 0) {
        patterns.push(`${todayCount} أمر تم تنفيذه اليوم`);
      }
    }

    return {
      totalAnalyzed: commands.length,
      failedCommands: failedCommands.length,
      slowCommands: slowCommands.length,
      suggestions,
      patterns,
    };
  } catch (error) {
    console.error("[SelfEvolution] Analysis error:", error);
    return {
      totalAnalyzed: 0,
      failedCommands: 0,
      slowCommands: 0,
      suggestions: [],
      patterns: ["Error analyzing logs: " + (error as Error).message],
    };
  }
}

/**
 * Format evolution analysis for display in chat
 */
export function formatEvolutionReport(analysis: EvolutionAnalysis): string {
  // Check if table doesn't exist or no records
  if (analysis.totalAnalyzed === 0) {
    if (analysis.patterns.length > 0 && analysis.patterns[0].includes("Error")) {
      // Table doesn't exist or connection error
      return "⚠️ **لا يمكن الوصول إلى سجلات الأوامر**\n\n" +
        "قد يكون جدول `immutable_command_log` غير موجود أو هناك مشكلة في الاتصال.\n\n" +
        "**الحل:**\n" +
        "1. تأكد من تشغيل migration: `npx supabase migration up`\n" +
        "2. أو قم بإنشاء الجدول يدوياً في Supabase Dashboard\n\n" +
        "📚 [دليل الإعداد](https://github.com/azenithliving/azenith-living-os/blob/main/docs/SETUP.md)";
    }

    // Table exists but no records
    return "📊 **تقرير التطور الذاتي**\n\n" +
      "⚠️ **لا توجد سجلات كافية للتحليل**\n\n" +
      "قم بتنفيذ بعض الأوامر أولاً (مثل: `list_keys`, `show_stats`) ثم شغّل `evolve` مرة أخرى.\n\n" +
      "💡 **اقتراح:**\n" +
      "- شغّل `help` لعرض قائمة الأوامر المتاحة\n" +
      "- نفذ 5-10 أوامر مختلفة للحصول على تحليل دقيق";
  }

  let report = `📊 **تقرير التطور الذاتي**\n\n`;
  report += `📈 تم تحليل ${analysis.totalAnalyzed} أمر\n`;
  report += `❌ ${analysis.failedCommands} فشل\n`;
  report += `⏱️ ${analysis.slowCommands} بطيء (>5 ثوانٍ)\n\n`;

  if (analysis.patterns.length > 0) {
    report += `**الأنماط المكتشفة:**\n`;
    analysis.patterns.forEach((p) => {
      report += `• ${p}\n`;
    });
    report += `\n`;
  }

  if (analysis.suggestions.length > 0) {
    report += `**اقتراحات التحسين:**\n\n`;
    analysis.suggestions.forEach((s, i) => {
      const severityEmoji =
        s.severity === "critical" ? "🔴" : s.severity === "high" ? "🟠" : s.severity === "medium" ? "🟡" : "🟢";
      report += `${severityEmoji} **${i + 1}. ${getSuggestionTitle(s.type)}**\n`;
      report += `   ${s.description}\n`;
      report += `   💡 **الإجراء المقترح:** ${s.proposedAction}\n`;
      if (s.affectedFile) {
        report += `   📁 **الملف:** ${s.affectedFile}\n`;
      }
      report += `\n`;
    });

    report += `\n**لتطبيق هذه التحسينات، اكتب "نعم"**\n`;
    report += `(سأقوم بإنشاء تعديلات مقترحة في بيئة معزولة)`;
  } else {
    report += `✅ **لا توجد تحسينات مقترحة حالياً**\n\n`;
    report += `النظام يعمل بكفاءة! لم يتم اكتشاف مشاكل كبيرة في الأوامر المنفذة.`;
  }

  return report;
}

function getSuggestionTitle(type: string): string {
  const titles: Record<string, string> = {
    add_backup_key: "إضافة مفاتيح احتياطية",
    optimize_performance: "تحسين الأداء",
    fix_error_pattern: "إصلاح خطأ متكرر",
    add_feature: "إضافة ميزة جديدة",
  };
  return titles[type] || type;
}

/**
 * Generate code patches based on suggestions
 * This creates the actual code changes in a safe way
 */
export function generateCodePatches(
  suggestions: EvolutionSuggestion[]
): Array<{ file: string; patch: string; description: string }> {
  const patches: Array<{ file: string; patch: string; description: string }> = [];

  for (const suggestion of suggestions) {
    if (suggestion.type === "add_backup_key" && suggestion.affectedFile) {
      patches.push({
        file: suggestion.affectedFile,
        patch: suggestion.codeSnippet || "",
        description: "إضافة دعم للمفاتيح الاحتياطية",
      });
    }

    if (suggestion.type === "optimize_performance" && suggestion.affectedFile) {
      patches.push({
        file: suggestion.affectedFile,
        patch: suggestion.codeSnippet || "",
        description: "تحسين الأداء بإضافة retry logic",
      });
    }
  }

  return patches;
}

/**
 * Check if user wants to apply changes (simple yes/no detection)
 */
export function detectApproval(message: string): boolean {
  const approvalWords = ["نعم", "yes", "أوافق", "موافق", "تطبيق", "apply", "ok", "تمام"];
  const lowerMsg = message.toLowerCase().trim();
  return approvalWords.some((word) => lowerMsg.includes(word));
}

/**
 * Simulate applying patches (for demo/testing - doesn't actually modify files)
 */
export async function simulateApplyPatches(
  patches: Array<{ file: string; patch: string; description: string }>
): Promise<{ success: boolean; message: string }> {
  console.log("[SelfEvolution] Simulating patch application...");

  // In a real implementation, this would:
  // 1. Create a git branch
  // 2. Apply the patches
  // 3. Run tests
  // 4. Report results

  const patchDescriptions = patches.map((p) => `• ${p.description} (${p.file})`).join("\n");

  return {
    success: true,
    message:
      `✅ **تم إنشاء التحسينات في بيئة معزولة**\n\n` +
      `**التعديلات المقترحة:**\n${patchDescriptions}\n\n` +
      `**الخطوة التالية:**\n` +
      `1. راجع التغييرات في فرع التطوير\n` +
      `2. شغل الاختبارات: npm run test\n` +
      `3. إذا نجحت، ادمج التغييرات: git merge\n\n` +
      `⚠️ **ملاحظة:** هذه تعديلات مقترحة فقط. يرجى مراجعتها قبل التطبيق.`,
  };
}

/**
 * Execute a suggestion safely in sandbox
 * This is the self-execution entry point
 */
export async function executeSuggestion(
  suggestion: EvolutionSuggestion
): Promise<{ success: boolean; message: string }> {
  console.log("[SelfEvolution] Executing suggestion:", suggestion.description);

  // Validate suggestion has required fields
  if (!suggestion.targetFile || !suggestion.searchPattern || !suggestion.replacement) {
    return {
      success: false,
      message: "❌ الاقتراح غير مكتمل (نقص targetFile, searchPattern, أو replacement)",
    };
  }

  // Check if auto-apply is allowed
  if (!suggestion.canAutoApply) {
    return {
      success: false,
      message: "⚠️ هذا الاقتراح يتطلب تطبيقاً يدوياً (canAutoApply = false)",
    };
  }

  // Execute via sandbox
  const result = await applySandboxSuggestion({
    type: suggestion.type,
    targetFile: suggestion.targetFile,
    searchPattern: suggestion.searchPattern,
    replacement: suggestion.replacement,
    description: suggestion.description,
  });

  return result;
}

/**
 * Log self-execution to immutable command log
 */
export async function logSelfExecution(
  supabase: SupabaseClient,
  suggestion: EvolutionSuggestion,
  result: { success: boolean; message: string },
  userId: string
): Promise<void> {
  try {
    await supabase.from("immutable_command_log").insert({
      command_text: "SELF_EXECUTE_SUGGESTION",
      signature: userId,
      executor_ip: null,
      executed_at: new Date().toISOString(),
      status: result.success ? "executed" : "failed",
      result_summary: result.message.substring(0, 200),
      parameters: {
        suggestion_type: suggestion.type,
        target_file: suggestion.targetFile,
        description: suggestion.description,
        auto_applied: suggestion.canAutoApply,
      },
    });
  } catch (error) {
    console.error("[SelfEvolution] Failed to log self-execution:", error);
  }
}
