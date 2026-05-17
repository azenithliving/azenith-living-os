/**
 * Intent classification for the unified admin assistant.
 * Fast heuristics first, AI second, action-oriented fallback last.
 */

import { askOrchestratorMessages } from "./ai-orchestrator";
import { detectCommand } from "./mastermind-ai";
import type { ClassifiedIntent, IntentKind } from "./admin-intent-types";
import { inferUltimateTool, wantsGenesis } from "./admin-tool-bridge";

export function needsMultiAgentMission(message: string): boolean {
  const t = message.trim();
  if (t.length < 12) return false;

  const lower = t.toLowerCase();
  const triggers = [
    /راجع.*(الموقع|النظام|كل)/,
    /حلل.*(و|ثم|وبعدين).*(نفذ|صلح|حسّن|طوّر)/,
    /فحص.*(أمن|جودة|اختبار|qa)/,
    /نفّ?ذ.*خطة/,
    /شغّ?ل.*(الوكلاء|الفريق|النظام)/,
    /حسّ?ن.*(الموقع|الأداء|التحويل)/,
    /اعمل.*(تقرير|خطة).*(شامل|كامل)/,
    /صلح.*(المشاكل|الأخطاء|كل)(?!.*seo)/i,
    /deploy|release|نشر.*الموقع/,
    /security.*(and|&).*(test|qa)/i,
    /analyze.*(and|then).*(fix|improve)/i,
    /full\s*(site|system)\s*(audit|review)/i,
    /واتساب.*(حملة|رد|أتمتة)/,
    /عملاء.*(تصنيف|متابعة|crm)/i,
    /غرف.*(تحديث|سعر|صور)/,
    /محتوى.*(توليد|ترجمة)/,
  ];

  if (triggers.some((p) => p.test(lower))) return true;
  if (t.length > 100 && /(و|ثم|كمان|also|and then)/i.test(t)) return true;
  return false;
}

/** User wants something done (not just chatting). */
export function detectActionOrientedRequest(message: string): boolean {
  const t = message.trim();
  if (t.length < 10) return false;
  const actionVerbs =
    /(اعمل|انشئ|أنشئ|انشاء|إنشاء|حذف|امسح|عدّل|غيّر|صلح|راجع|حلل|نفّ?ذ|شغّ?ل|ابعت|ارسل|أرسل|فعّ?ل|عطّ?ل|حدّ?ث|نسخ|استرجع|حلّ?ل|قارن|راقب|ترجم|صنّ?ف|استورد|ابني|update|create|delete|fix|run|deploy|send|backup|restore|optimize|audit|build|migrate|import|export|translate|generate)/i;
  return actionVerbs.test(t);
}

export function heuristicClassify(
  message: string,
  opts?: { minConfidence?: number }
): ClassifiedIntent | null {
  const minConf = opts?.minConfidence ?? 0.75;
  const lower = message.toLowerCase().trim();

  if (/فحص.*المفاتيح|check.*keys|usage.*keys/i.test(lower)) {
    return {
      kind: "command",
      command: "check_keys",
      commandLine: "check_keys",
      confidence: 0.9,
      reasoning: "keys-check",
    };
  }

  if (/نسخ.*احتياط|backup/i.test(lower) && /إعداد|settings|جداول/i.test(lower)) {
    const settingsBackup = inferUltimateTool(message);
    if (settingsBackup) {
      return {
        kind: "ultimate_tool",
        toolName: settingsBackup.toolName,
        toolParams: settingsBackup.params,
        confidence: 0.85,
        reasoning: "settings-backup",
      };
    }
  }

  const cmd = detectCommand(message);
  if (cmd && cmd.confidence >= minConf) {
    return {
      kind: "command",
      command: cmd.command,
      commandLine: `${cmd.command} ${cmd.args.join(" ")}`.trim(),
      confidence: cmd.confidence,
      reasoning: "pattern",
    };
  }

  if (wantsGenesis(message)) {
    return { kind: "genesis", confidence: 0.85, reasoning: "genesis" };
  }

  const ultimate = inferUltimateTool(message);
  if (ultimate) {
    return {
      kind: "ultimate_tool",
      toolName: ultimate.toolName,
      toolParams: ultimate.params,
      confidence: 0.85,
      reasoning: "ultimate",
    };
  }

  if (/لون|theme|ذهبي|أتمتة|automation/i.test(lower)) {
    if (/أتمتة|automation|قاعدة/i.test(lower)) {
      return {
        kind: "architect",
        architectAction: "createAutomationRule",
        architectParams: {
          name: "قاعدة من الأدمن",
          trigger: "page_visit",
          conditions: {},
          actions: [{ type: "notification" }],
        },
        confidence: 0.7,
      };
    }
    if (/لون.*ذهبي|theme.*gold|اللون.*ذهبي/i.test(lower)) {
      return {
        kind: "architect",
        architectAction: "updateSiteSetting",
        architectParams: { key: "theme", value: { primaryColor: "#C5A059" } },
        confidence: 0.75,
      };
    }
  }

  if (/واتساب|whatsapp/i.test(lower) && /حملة|رد|أتمتة|campaign/i.test(lower)) {
    return { kind: "agents", confidence: 0.88, reasoning: "whatsapp-mission" };
  }

  if (needsMultiAgentMission(message)) {
    return { kind: "agents", confidence: 0.85, reasoning: "multi-agent" };
  }

  if (
    /مفاتيح|مفتاح|keys/i.test(lower) &&
    /كم|عدد|حالة|وريني|اعرض|متاح|list|status/i.test(lower)
  ) {
    const providerMatch = lower.match(
      /\b(groq|openrouter|mistral|gemini|openai|deepseek|anthropic|together)\b/
    );
    const line = providerMatch
      ? `list_keys ${providerMatch[1]}`
      : "list_keys";
    return {
      kind: "command",
      command: "list_keys",
      commandLine: line,
      confidence: 0.88,
      reasoning: "keys-query",
    };
  }

  if (/إحصائيات|statistics|show_stats|stats\b/i.test(lower) && !/seo/i.test(lower)) {
    const daysMatch = lower.match(/\b(\d+)\s*(يوم|days?)\b/);
    const days = daysMatch ? daysMatch[1] : "7";
    return {
      kind: "command",
      command: "show_stats",
      commandLine: `show_stats ${days}`,
      confidence: 0.82,
      reasoning: "stats",
    };
  }

  if (/مسح.*(كاش|cache)|clear.*cache/i.test(lower)) {
    return {
      kind: "command",
      command: "clear_cache",
      commandLine: "clear_cache",
      confidence: 0.85,
      reasoning: "cache",
    };
  }

  if (/نسخ.*احتياط.*(قاعدة|db)|backup_db/i.test(lower)) {
    return {
      kind: "command",
      command: "backup_db",
      commandLine: "backup_db",
      confidence: 0.85,
      reasoning: "backup-cmd",
    };
  }

  if (/تطور|evolve|self.*improve|تعلم.*من.*أخطاء/i.test(lower)) {
    return {
      kind: "command",
      command: "evolve",
      commandLine: "evolve",
      confidence: 0.8,
      reasoning: "evolve",
    };
  }

  if (/مساعدة|help|الأوامر|commands available/i.test(lower)) {
    return {
      kind: "command",
      command: "help",
      commandLine: "help",
      confidence: 0.9,
      reasoning: "help",
    };
  }

  if (
    /زوار|visitors|تحليلات|analytics|conversion|leads/i.test(lower) &&
    !/أتمتة|automation|قاعدة/i.test(lower)
  ) {
    const days = /90|تلات|ثلاث/i.test(lower) ? 90 : /30|شهر/i.test(lower) ? 30 : 7;
    return { kind: "analytics", analyticsDays: days as 7 | 30 | 90, confidence: 0.8 };
  }

  if (
    /صحة|health|شغال\s*تمام|كل\s*حاجة\s*تمام|الموقع.*شغال|uptime|مشكلة.*(الموقع|النظام)/i.test(
      lower
    ) &&
    !/show_stats|إحصائيات/i.test(lower)
  ) {
    return { kind: "health", confidence: 0.8 };
  }

  return null;
}

async function aiClassifyIntent(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<ClassifiedIntent> {
  const historySnippet = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const system = `أنت عقل الأدمن لموقع Azenith Living. المالك يتكلم بلغته الطبيعية (عربي/إنجليزي) بدون أوامر برمجية.
حدد أفضل إجراء واحد فقط. أخرج JSON صالح فقط:

{
  "kind": "command|agents|architect|analytics|health|ultimate_tool|genesis|conversation",
  "command": "list_keys|check_keys|show_stats|evolve|backup_db|clear_cache|help|add_key|... أو null",
  "commandLine": "سطر الأمر إن وُجد",
  "toolName": "seo_analyze|section_create|... أو null",
  "toolParams": {},
  "architectAction": "updateSiteSetting|createAutomationRule|null",
  "architectParams": {},
  "analyticsDays": 7,
  "confidence": 0.0-1.0,
  "reasoning": "كلمة واحدة"
}

قواعد:
- agents: أي طلب معقّد أو غير مُغطى بأمر بسيط — فحص شامل، تحليل+تنفيذ، مبيعات، واتساب، محتوى، غرف
- command: مفاتيح API، إحصائيات، كاش، evolve، help
- ultimate_tool: أقسام، SEO، سرعة، أهداف، إيرادات
- architect: ألوان، إعدادات، أتمتة
- analytics: زوار وتحويلات
- health: فحص صحة الموقع
- genesis: تكوين/بناء هيكلي
- conversation: تحية فقط`;

  const user = `سياق سابق:\n${historySnippet || "(لا يوجد)"}\n\nرسالة الأدمن الآن:\n${message}`;

  const result = await askOrchestratorMessages(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.2, maxTokens: 400, jsonMode: true }
  );

  if (!result.success || !result.content) {
    return { kind: "conversation", confidence: 0.5, reasoning: "orchestrator-fallback" };
  }

  try {
    const raw = result.content.replace(/```json\n?|\n?```/g, "").trim();
    const p = JSON.parse(raw) as Partial<ClassifiedIntent> & { kind?: string };
    const kind = (p.kind || "conversation") as IntentKind;
    if (
      ![
        "command",
        "agents",
        "architect",
        "analytics",
        "health",
        "ultimate_tool",
        "genesis",
        "conversation",
      ].includes(kind)
    ) {
      return { kind: "conversation", confidence: 0.5 };
    }
    return {
      kind,
      command: p.command,
      commandLine: p.commandLine,
      toolName: p.toolName,
      toolParams: p.toolParams,
      architectAction: p.architectAction as ClassifiedIntent["architectAction"],
      architectParams: p.architectParams,
      analyticsDays: (p.analyticsDays as 7 | 30 | 90) || 7,
      confidence: typeof p.confidence === "number" ? p.confidence : 0.7,
      reasoning: p.reasoning,
    };
  } catch {
    return { kind: "conversation", confidence: 0.5, reasoning: "parse-fail" };
  }
}

/**
 * Last-chance routing before pure chat — catches unprogrammed action requests.
 */
export function opportunisticClassify(message: string): ClassifiedIntent | null {
  const soft = heuristicClassify(message, { minConfidence: 0.55 });
  if (soft) return soft;

  if (detectActionOrientedRequest(message)) {
    return { kind: "agents", confidence: 0.68, reasoning: "action-fallback" };
  }

  return null;
}

export async function classifyAdminIntent(
  message: string,
  history: Array<{ role: string; content: string }> = [],
  options?: { skipAi?: boolean }
): Promise<ClassifiedIntent> {
  const fast = heuristicClassify(message);
  if (fast && fast.confidence >= 0.8) return fast;

  if (!options?.skipAi) {
    const ai = await aiClassifyIntent(message, history);
    if (ai.confidence >= 0.55) return ai;
  }

  const opportunistic = opportunisticClassify(message);
  if (opportunistic) return opportunistic;

  return { kind: "conversation", confidence: 0.6, reasoning: "chat" };
}
