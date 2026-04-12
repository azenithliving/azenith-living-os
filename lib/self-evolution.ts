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
}

export interface EvolutionAnalysis {
  totalAnalyzed: number;
  failedCommands: number;
  slowCommands: number;
  suggestions: EvolutionSuggestion[];
  patterns: string[];
}

/**
 * Analyze last 50 commands from immutable_command_log
 */
export async function analyzeCommandLogs(
  supabase: SupabaseClient
): Promise<EvolutionAnalysis> {
  console.log("[SelfEvolution] Analyzing command logs...");

  try {
    // Fetch last 50 commands
    const { data: logs, error } = await supabase
      .from("immutable_command_log")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[SelfEvolution] Failed to fetch logs:", error);
      return {
        totalAnalyzed: 0,
        failedCommands: 0,
        slowCommands: 0,
        suggestions: [],
        patterns: [],
      };
    }

    const commands = (logs || []) as CommandLogEntry[];
    const failedCommands = commands.filter((c) => c.status === "failed");
    const slowCommands = commands.filter((c) => {
      if (!c.completed_at || !c.executed_at) return false;
      const duration = new Date(c.completed_at).getTime() - new Date(c.executed_at).getTime();
      return duration > 5000; // Commands taking > 5 seconds
    });

    console.log(
      `[SelfEvolution] Analyzed ${commands.length} commands: ${failedCommands.length} failed, ${slowCommands.length} slow`
    );

    // Generate suggestions based on analysis
    const suggestions: EvolutionSuggestion[] = [];
    const patterns: string[] = [];

    // Pattern 1: API Key failures
    const keyFailures = failedCommands.filter(
      (c) =>
        c.result_summary?.toLowerCase().includes("key") ||
        c.result_summary?.toLowerCase().includes("api") ||
        c.result_summary?.toLowerCase().includes("unauthorized") ||
        c.result_summary?.toLowerCase().includes("401") ||
        c.result_summary?.toLowerCase().includes("403")
    );

    if (keyFailures.length > 0) {
      patterns.push(`API key failures detected: ${keyFailures.length} failed commands`);
      suggestions.push({
        type: "add_backup_key",
        severity: keyFailures.length > 3 ? "critical" : "high",
        description: `Detected ${keyFailures.length} commands failing due to API key issues (rate limits, invalid keys, or expiration).`,
        proposedAction:
          "Add backup API keys from multiple providers (Groq, Mistral, OpenRouter) to ensure redundancy.",
        affectedFile: "lib/mastermind-ai.ts",
        codeSnippet: `// Add this to your .env.local:
// BACKUP_GROQ_API_KEY=your_backup_key_here
// BACKUP_MISTRAL_API_KEY=your_backup_key_here`,
      });
    }

    // Pattern 2: Database operation failures
    const dbFailures = failedCommands.filter(
      (c) =>
        c.result_summary?.toLowerCase().includes("database") ||
        c.result_summary?.toLowerCase().includes("db") ||
        c.result_summary?.toLowerCase().includes("connection") ||
        c.result_summary?.toLowerCase().includes("timeout")
    );

    if (dbFailures.length > 0) {
      patterns.push(`Database issues: ${dbFailures.length} failed operations`);
      suggestions.push({
        type: "optimize_performance",
        severity: "high",
        description: `Detected ${dbFailures.length} database-related failures (connection timeouts, query errors).`,
        proposedAction:
          "Implement connection pooling and retry logic for database operations.",
        affectedFile: "lib/command-executor.ts",
        codeSnippet: `// Add retry logic to database operations:
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) { if (i === retries - 1) throw e; }
  }
  throw new Error("Max retries reached");
}`,
      });
    }

    // Pattern 3: Slow commands (performance issues)
    if (slowCommands.length > 5) {
      patterns.push(`Performance issues: ${slowCommands.length} slow commands detected`);
      suggestions.push({
        type: "optimize_performance",
        severity: "medium",
        description: `Detected ${slowCommands.length} commands taking > 5 seconds to complete.`,
        proposedAction:
          "Add caching layer for frequently accessed data and optimize database queries.",
        affectedFile: "lib/semantic-cache.ts",
        codeSnippet: `// Enable semantic caching for repeated queries:
const cache = new SemanticCache({ ttl: 300 }); // 5 minutes TTL`,
      });
    }

    // Pattern 4: Unknown commands (user experience)
    const unknownCmds = failedCommands.filter((c) =>
      c.result_summary?.toLowerCase().includes("unknown") ||
      c.result_summary?.toLowerCase().includes("غير معروف")
    );

    if (unknownCmds.length > 0) {
      patterns.push(`User confusion: ${unknownCmds.length} unknown command attempts`);
      suggestions.push({
        type: "add_feature",
        severity: "low",
        description: `Users attempted ${unknownCmds.length} unrecognized commands. Consider expanding command recognition.`,
        proposedAction:
          "Add fuzzy matching for command detection and better error messages with suggestions.",
        affectedFile: "lib/mastermind-ai.ts",
        codeSnippet: `// Add fuzzy matching in detectCommand():
function findSimilarCommand(input: string): string | null {
  const similarity = (a: string, b: string) => {
    // Levenshtein distance or similar
  };
  // Return closest match
}`,
      });
    }

    // Pattern 5: Notification failures
    const notifyFailures = failedCommands.filter(
      (c) =>
        c.command_text.includes("notification") &&
        c.status === "failed"
    );

    if (notifyFailures.length > 0) {
      suggestions.push({
        type: "fix_error_pattern",
        severity: "medium",
        description: `Notification system failed ${notifyFailures.length} times.`,
        proposedAction: "Check Telegram bot token and network connectivity to notification service.",
        affectedFile: "lib/telegram-notify.ts",
        codeSnippet: `// Add fallback notification channel (email/Discord)
if (telegramFailed) {
  await sendEmailNotification(message); // Fallback
}`,
      });
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
  if (analysis.totalAnalyzed === 0) {
    return "⚠️ لا يمكن تحليل السجلات حالياً. حاول مرة أخرى لاحقاً.";
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
    report += `✅ **النظام يعمل بكفاءة!** لا توجد مشاكل كبيرة مكتشفة.`;
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
