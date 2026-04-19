/**
 * Ultimate Agent Core
 *
 * A practical orchestration layer for the admin intelligence console:
 * - Routes requests to the right model family
 * - Uses real tools instead of canned replies when possible
 * - Persists memory and goals
 * - Applies approval gates for risky actions
 */

import { getOrchestratorHealth } from "@/lib/ai-orchestrator";
import {
  executeTool,
  TOOL_DEFINITIONS as REAL_TOOL_DEFINITIONS,
  ToolName,
} from "@/lib/real-tool-executor";
import {
  analyzeSEO,
} from "@/lib/seo-analyzer";
import {
  getSystemHealth,
} from "@/lib/architect-tools";
import { generateSystemSnapshot, getSystemOverview } from "@/lib/discovery-engine";
import { askGroq, askGroqMessages } from "@/lib/ai-orchestrator";
import { routeRequest, getBestModelForTask } from "@/lib/openrouter-service";
import { plannerAgent, type StrategicPlan } from "@/lib/planner-agent";
import {
  createGoal,
  getActiveGoals,
  getRecentMemories,
  getUserPreference,
  storeMemory,
} from "./memory-store";
import {
  type AgentAction,
  approveRequest,
  classifyRisk,
  createApprovalRequest,
  getPendingApprovals,
  getSecurityStats,
  logAuditEvent,
  rejectRequest,
  validateAction,
} from "./security-manager";
import {
  detectAnomalies,
  generateOpportunities,
  generateStrategicRecommendations,
  getMetricsSnapshot,
} from "./predictive-engine";
import {
  parseNaturalLanguage,
  generateClarifyingQuestion,
  handleFollowUp,
  type NLUContext,
} from "./natural-language-engine";
import {
  reason,
  executeBasedOnReasoning,
  type ReasoningContext,
} from "./reasoning-core";
import {
  createTrueAgent,
  processWithTrueAgent,
} from "./true-agent";

export type IntentName =
  | "greeting"
  | "help"
  | "self_improvement"
  | "status"
  | "metrics"
  | "anomalies"
  | "opportunities"
  | "system_scan"
  | "daily_report"
  | "seo_audit"
  | "content_audit"
  | "revenue_analysis"
  | "plan"
  | "goal_create"
  | "theme_change"
  | "background_change"
  | "automation_rule"
  | "section_create"
  // Product Management Intents
  | "product_list"
  | "product_create"
  | "product_update"
  | "product_delete"
  | "product_get"
  | "category_list"
  | "category_create"
  | "inventory_check"
  | "inventory_update"
  | "backup"
  | "speed_optimization"
  | "adsense_setup"
  | "affiliate_links"
  // Memory & Preferences
  | "memory_store"
  | "preference_update"
  | "general_chat";

interface InterpretedIntent {
  name: IntentName;
  objective: string;
  taskType: string;
  confidence: number;
  requiresPlanning: boolean;
  params: Record<string, unknown>;
  suggestions: string[];
}

interface CommandContext {
  recentMessages: string[];
  activeGoals: string[];
  userName?: string;
}

interface RelationContext {
  companyId?: string;
  actorUserId?: string;
  commandLogId?: string;
}

export interface AgentConfig {
  name: string;
  autoExecuteNormal: boolean;
  autoExecuteInfo: boolean;
  requireApprovalFor: string[];
  checkIntervalMinutes: number;
  maxDailyActions: number;
  learningEnabled: boolean;
  proactiveMode: boolean;
  notificationChannels: string[];
}

export interface AgentStatus {
  isActive: boolean;
  lastCheck: Date;
  nextCheck: Date;
  pendingApprovals: number;
  actionsToday: number;
  anomaliesDetected: number;
  goalsActive: number;
  mode: "active" | "paused" | "maintenance";
  modelMesh?: Array<{ provider: string; healthy: boolean; keys: number }>;
  capabilities?: string[];
}

export interface ActionPlan {
  id: string;
  title: string;
  description: string;
  actions: Array<{
    type: string;
    payload: Record<string, unknown>;
    reason: string;
    priority: string;
  }>;
  expectedOutcome: string;
  requiresApproval: boolean;
  riskLevel: string;
  autoExecute: boolean;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  actionTaken?: string;
  requiresApproval?: boolean;
  approvalRequestId?: string;
  suggestions?: string[];
}

export interface AgentResponse {
  action: string;
  params: Record<string, unknown>;
  reply: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  name: "Azenith Ultimate Agent",
  autoExecuteNormal: true,
  autoExecuteInfo: true,
  requireApprovalFor: ["critical", "forbidden"],
  checkIntervalMinutes: 60,
  maxDailyActions: 100,
  learningEnabled: true,
  proactiveMode: true,
  notificationChannels: ["telegram", "email"],
};

let currentConfig: AgentConfig = { ...DEFAULT_CONFIG };

const agentStatus: AgentStatus = {
  isActive: true,
  lastCheck: new Date(),
  nextCheck: new Date(Date.now() + 60 * 60 * 1000),
  pendingApprovals: 0,
  actionsToday: 0,
  anomaliesDetected: 0,
  goalsActive: 0,
  mode: "active",
  modelMesh: [],
  capabilities: [],
};

const STATIC_CAPABILITIES = [
  "قراءة المؤشرات والأنوماليز والفرص",
  "تحليل SEO حقيقي (درجات حقيقية، مشاكل حقيقية، توصيات مخصصة)",
  "إنشاء أقسام موقع حقيقية في قاعدة البيانات",
  "إنشاء نسخ احتياطية حقيقية مع روابط تحميل",
  "تحديث الإعدادات مع نظام إصدارات وتراجع",
  "تخطيط مهام متعددة الخطوات",
  "إنشاء أهداف قابلة للمتابعة",
  "إنشاء قواعد أتمتة",
  "اقتراح وتنفيذ تغييرات الموقع بعد الموافقة",
  "تحليل السرعة والأداء الفعلي",
  "تحليل الفرص والإيرادات من بيانات حقيقية",
  // Product Management Capabilities
  "إدارة المنتجات الحقيقية (إضافة، تحديث، حذف)",
  "فحص المخزون والتنبيهات التلقائية",
  "تحديث المخزون مع نظام مراجعة",
  "إدارة فئات المنتجات",
];

function safeJsonParse<T>(value: string): T | null {
  const match = value.match(/\{[\s\S]*\}/);
  const candidate = match ? match[0] : value;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

function extractQuotedText(text: string): string | undefined {
  const quoted = text.match(/["'“”](.+?)["'“”]/);
  return quoted?.[1]?.trim();
}

function extractFirstNumber(text: string): number | undefined {
  const match = text.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function extractHexColor(text: string): string | undefined {
  const match = text.match(/#(?:[0-9a-fA-F]{3}){1,2}/);
  return match?.[0];
}

function resolveNamedColor(text: string): string | undefined {
  const lower = text.toLowerCase();
  const mapped = [
    { patterns: ["ذهبي", "gold"], value: "#C5A059" },
    { patterns: ["أزرق", "ازرق", "blue"], value: "#2563EB" },
    { patterns: ["أحمر", "احمر", "red"], value: "#DC2626" },
    { patterns: ["أخضر", "اخضر", "green"], value: "#059669" },
    { patterns: ["أسود", "اسود", "black"], value: "#0A0A0A" },
    { patterns: ["أبيض", "ابيض", "white"], value: "#FFFFFF" },
    { patterns: ["رمادي", "gray", "grey"], value: "#6B7280" },
  ];
  return mapped.find((entry) => entry.patterns.some((pattern) => lower.includes(pattern)))?.value;
}

function summarizePlan(plan: StrategicPlan): string {
  return [
    `الهدف: ${plan.goal}`,
    `عدد الخطوات: ${plan.subtasks.length}`,
    `الوقت المتوقع: ${plan.estimatedTotalMinutes} دقيقة`,
    ...plan.subtasks.slice(0, 5).map(
      (task, index) =>
        `${index + 1}. ${task.title} | ${task.assignedAgent} | ${task.estimatedMinutes}د`
    ),
  ].join("\n");
}

function buildModelMesh() {
  const health = getOrchestratorHealth();
  return [
    { provider: "groq", healthy: health.groq.healthy, keys: health.groq.keys },
    { provider: "openrouter", healthy: health.openrouter.healthy, keys: health.openrouter.keys },
    { provider: "mistral", healthy: health.mistral.healthy, keys: health.mistral.keys },
    { provider: "deepseek", healthy: health.deepseek.healthy, keys: health.deepseek.keys },
  ];
}

function normalizeSuggestions(suggestions: string[] | undefined, fallback: string[]) {
  const merged = [...(suggestions || []), ...fallback]
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(merged)).slice(0, 5);
}

function buildLocalConversationalReply(message: string, context: CommandContext): string {
  const lower = message.toLowerCase().trim();
  const name = context.userName ? ` ${context.userName}` : "";

  if (
    /(ازيك|إزيك|ازيكم|ازيكم|عامل ايه|عاملة ايه|اخبارك|أخبارك|مساء العسل|مساء الورد|هلا|هلا والله)/.test(
      lower
    )
  ) {
    return `أهلاً${name}. أنا شغال معك فعلياً داخل لوحة الاستخبارات. إذا عندك هدف محدد أقدر أحوّله لتحليل أو خطة أو تنفيذ داخل النظام.`;
  }

  if (/(مين انت|من انت|عرفني بنفسك|احكيلي عنك|احكي لي عنك)/.test(lower)) {
    return "أنا نواة تنفيذ وتحليل داخل Azenith Living. شغلي الحقيقي: فهم الطلب، ربطه بالأدوات والبيانات المتاحة، ثم تنفيذ ما يمكن تنفيذه أو بناء خطة واضحة لما يحتاج توسعة.";
  }

  if (/(مش فاهم|مش فهمت|فهمني|اشرح|اشرحي)/.test(lower)) {
    return "الطريقة الصحيحة للتعامل معي الآن: قولي الهدف مباشرة. مثال: حلّل SEO، اعمل خطة لتطوير الوكيل، غيّر اللون الأساسي، أو أنشئ قاعدة أتمتة.";
  }

  return [
    "أقدر أتعامل مع الطلبات العامة، لكن الأفضل أن تحوليها لهدف مباشر.",
    "مثال:",
    "- حلّل هذه الصفحة",
    "- خطط لتوسيع قدرات الوكيل",
    "- غيّر إعداداً معيّناً",
    "- أنشئ أتمتة لسيناريو محدد",
  ].join("\n");
}

async function buildCommandContext(): Promise<CommandContext> {
  const [recentMemories, goals, userNamePreference] = await Promise.all([
    getRecentMemories(6, ["interaction", "decision", "suggestion"]),
    getActiveGoals(),
    getUserPreference("user", "name"),
  ]);

  const formattedMemories = recentMemories.memories
    ?.slice(0, 6)
    .reverse() // Reverse to get chronological order (oldest first)
    .map((memory) => {
      const role = memory.context?.role === "user" ? "User" : "Agent";
      return `${role}: ${memory.content}`;
    })
    .filter(Boolean) || [];

  return {
    recentMessages: formattedMemories,
    activeGoals: goals.goals?.map((goal) => `${goal.title} (${goal.progress}%)`).slice(0, 5) || [],
    userName:
      typeof userNamePreference.value === "string" && userNamePreference.value.trim()
        ? userNamePreference.value.trim()
        : undefined,
  };
}

function buildToolApprovalAction(
  type: string,
  category: AgentAction["category"],
  description: string,
  payload: Record<string, unknown>,
  estimatedImpact: AgentAction["estimatedImpact"]
): Omit<AgentAction, "riskLevel" | "requiresApproval"> {
  return {
    id: crypto.randomUUID(),
    type,
    category,
    description,
    payload,
    estimatedImpact,
  };
}

async function executeApprovedOrImmediateTool(options: {
  action: Omit<AgentAction, "riskLevel" | "requiresApproval">;
  toolName: string;
  params: Record<string, unknown>;
  approvalMetadata?: Record<string, unknown>;
  successAction: string;
  fallbackSuggestions?: string[];
  relationContext?: RelationContext;
}): Promise<CommandResult> {
  const risk = classifyRisk(options.action);
  const securedAction: AgentAction = {
    ...options.action,
    riskLevel: risk.riskLevel,
    requiresApproval: risk.requiresApproval,
  };

  const validation = validateAction(securedAction);
  if (!validation.allowed) {
    return {
      success: false,
      message: validation.reason || "الإجراء مرفوض أمنياً.",
      actionTaken: "blocked_by_policy",
      suggestions: normalizeSuggestions([], ["اعرض القدرات", "حالة الوكيل"]),
    };
  }

  if (risk.requiresApproval) {
    const approval = await createApprovalRequest(
      securedAction,
      {
        executor: "tool",
        toolName: options.toolName,
        params: options.params,
        ...options.approvalMetadata,
      },
      options.relationContext
    );

    if (!approval.success || !approval.request?.id) {
      return {
        success: false,
        message: approval.error || "تعذر إنشاء طلب الموافقة.",
        actionTaken: "approval_request_failed",
      };
    }

    return {
      success: true,
      message: `الإجراء جاهز لكنه يحتاج موافقتك أولاً: ${options.action.description}`,
      requiresApproval: true,
      approvalRequestId: approval.request.id,
      actionTaken: "approval_requested",
      suggestions: normalizeSuggestions(options.fallbackSuggestions, ["الموافقات", "حالة الوكيل"]),
    };
  }

  const result = await executeTool(
    options.toolName as ToolName,
    options.params,
    {
      executionId: crypto.randomUUID(),
      companyId: options.relationContext?.companyId,
      actorUserId: options.relationContext?.actorUserId,
    },
    { autoApprove: true }
  );

  return {
    success: result.success,
    message: result.message,
    data: result.data,
    actionTaken: result.success ? options.successAction : `${options.successAction}_failed`,
    suggestions: normalizeSuggestions(options.fallbackSuggestions, ["المؤشرات", "التوصيات"]),
  };
}

/**
 * Map intent name to task type
 */
function getTaskType(intent: IntentName): string {
  const taskTypes: Record<string, string> = {
    greeting: "general",
    help: "general",
    status: "analysis",
    metrics: "analysis",
    anomalies: "analysis",
    opportunities: "analysis",
    system_scan: "analysis",
    daily_report: "analysis",
    seo_audit: "analysis",
    content_audit: "analysis",
    revenue_analysis: "analysis",
    plan: "planning",
    goal_create: "planning",
    theme_change: "configuration",
    background_change: "configuration",
    automation_rule: "operations",
    section_create: "planning",
    product_list: "operations",
    product_create: "operations",
    product_update: "operations",
    product_delete: "operations",
    product_get: "operations",
    category_list: "operations",
    category_create: "operations",
    inventory_check: "operations",
    inventory_update: "operations",
    backup: "operations",
    speed_optimization: "analysis",
    adsense_setup: "configuration",
    affiliate_links: "configuration",
    memory_store: "memory",
    preference_update: "memory",
    general_chat: "general",
  };

  return taskTypes[intent] || "general";
}

function detectIntentHeuristically(message: string): InterpretedIntent | null {
  const lower = message.toLowerCase();

  if (
    /(اهلا|أهلا|مرحبا|hello|hi|صباح الخير|مساء الخير|ازيك|إزيك|ازيكم|ازيكم|عامل ايه|عاملة ايه|اخبارك|أخبارك|مساء العسل|مساء الورد|هلا)/.test(
      lower
    )
  ) {
    return {
      name: "greeting",
      objective: message,
      taskType: "general",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["حالة الوكيل", "المؤشرات", "لقطة للنظام"],
    };
  }

  if (
    /(طور نفسك|طوّر نفسك|تزود قدراتك|زود قدراتك|تتعلم|تعلم من نفسك|تكبر قدراتك|تكبّر قدراتك|upgrade yourself|self-improve|self improve)/.test(
      lower
    )
  ) {
    return {
      name: "self_improvement",
      objective: message,
      taskType: "planning",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["خطط لتطوير الوكيل", "حالة الوكيل", "لقطة للنظام"],
    };
  }

  if (
    /((احكيلي|احكي لي|قل لي|قول لي).*(عنك|قدراتك)|ماذا تستطيع|ما الذي تستطيع|ايه قدراتك|قدراتك|ساعدني|help)/.test(
      lower
    )
  ) {
    return {
      name: "help",
      objective: message,
      taskType: "general",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["المؤشرات", "الفرص", "خطط لمهمة جديدة"],
    };
  }

  if (/(حالة الوكيل|status|حالة النظام)/.test(lower)) {
    return {
      name: "status",
      objective: message,
      taskType: "analysis",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["المؤشرات", "الشذوذ", "الفرص"],
    };
  }

  if (/(المؤشرات|metrics|analytics)/.test(lower)) {
    return {
      name: "metrics",
      objective: message,
      taskType: "analysis",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["الشذوذ", "الفرص", "تقرير يومي"],
    };
  }

  if (/(الشذوذ|anomalies|alerts)/.test(lower)) {
    return {
      name: "anomalies",
      objective: message,
      taskType: "analysis",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["المؤشرات", "الفرص", "لقطة للنظام"],
    };
  }

  if (/(الفرص|opportunities|recommendations|التوصيات)/.test(lower)) {
    return {
      name: "opportunities",
      objective: message,
      taskType: "analysis",
      confidence: 0.95,
      requiresPlanning: false,
      params: {},
      suggestions: ["المؤشرات", "تقرير يومي", "خطط لمهمة جديدة"],
    };
  }

  if (/(لقطة للنظام|system scan|snapshot|scan)/.test(lower)) {
    return {
      name: "system_scan",
      objective: message,
      taskType: "analysis",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["حالة الوكيل", "المؤشرات", "الخطط"],
    };
  }

  if (/(تقرير يومي|daily report|تقرير)/.test(lower)) {
    return {
      name: "daily_report",
      objective: message,
      taskType: "analysis",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["المؤشرات", "الفرص", "الشذوذ"],
    };
  }

  if (/(seo|سيو|محركات البحث)/.test(lower)) {
    return {
      name: "seo_audit",
      objective: message,
      taskType: "analysis",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["المحتوى", "الفرص", "حسّن السرعة"],
    };
  }

  if (/(المحتوى|content|صور|روابط)/.test(lower)) {
    return {
      name: "content_audit",
      objective: message,
      taskType: "analysis",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["SEO audit", "المؤشرات", "الفرص"],
    };
  }

  if (/(ربح|أرباح|ارباح|revenue|دخل)/.test(lower)) {
    return {
      name: "revenue_analysis",
      objective: message,
      taskType: "analysis",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["الفرص", "المؤشرات", "تقرير يومي"],
    };
  }

  if (/(نسخ احتياطي|backup)/.test(lower)) {
    return {
      name: "backup",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["حالة الوكيل", "لقطة للنظام"],
    };
  }

  if (/(سرعة|performance|optimize speed|حسّن السرعة)/.test(lower)) {
    return {
      name: "speed_optimization",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["SEO audit", "المؤشرات", "الفرص"],
    };
  }

  // MEMORY & PREFERENCES - Check BEFORE product creation to avoid confusion
  if (/(احفظ|اسمي|اسمك|تذكر|ذاكرتك|preference|my name is|call me)/.test(lower)) {
    const nameMatch = message.match(/(?:اسمي|اسمك|my name is|call me|أنا|انا)\s+["']?(\w+)["']?/i);
    const infoMatch = message.match(/(?:احفظ|تذكر|خلي في ذاكرتك)\s+(.+?)(?:\s+\w+\s*|$)/i);
    
    return {
      name: "preference_update",
      objective: message,
      taskType: "memory",
      confidence: 0.9,
      requiresPlanning: false,
      params: {
        name: nameMatch?.[1],
        info: infoMatch?.[1],
        rawMessage: message,
      },
      suggestions: ["حالة الوكيل", "تذكر اسمي", "المؤشرات"],
    };
  }

  if (/(اعرض المنتجات|قائمة المنتجات|list products)/.test(lower)) {
    return {
      name: "product_list",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["أضف منتج", "المؤشرات"],
    };
  }

  if (/(أضف منتج|اضف منتج|منتج جديد|انشئ منتج|أنشئ منتج)/.test(lower)) {
    const name = extractQuotedText(message);
    const price = extractFirstNumber(message);
    return {
      name: "product_create",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: { name, basePrice: price },
      suggestions: ["اعرض المنتجات", "افحص المخزون", "حلل المبيعات"],
    };
  }

  if (/(تحديث منتج|تعديل منتج|تحديث سعر منتج)/.test(lower)) {
    return {
      name: "product_update",
      objective: message,
      taskType: "operations",
      confidence: 0.8,
      requiresPlanning: false,
      params: {},
      suggestions: ["اعرض المنتجات", "افحص المخزون"],
    };
  }

  if (/(احذف منتج|حذف منتج|مسح منتج)/.test(lower)) {
    return {
      name: "product_delete",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["اعرض المنتجات", "تأكيد الحذف"],
    };
  }

  if (/(تفاصيل منتج|معلومات منتج|احصل على منتج)/.test(lower)) {
    return {
      name: "product_get",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["اعرض المنتجات", "تحديث المنتج"],
    };
  }

  if (/(افحص المخزون|فحص المخزون|حالة المخزون|المنتجات منخفضة|المنتجات التي نفذت)/.test(lower)) {
    return {
      name: "inventory_check",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["أضف منتج", "تحديث مخزون", "اعرض المنتجات"],
    };
  }

  if (/(تحديث مخزون|تعديل مخزون|زيادة مخزون|نقص مخزون|اضافة مخزون)/.test(lower)) {
    return {
      name: "inventory_update",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["افحص المخزون", "اعرض المنتجات"],
    };
  }

  if (/(أضف تصنيف|اضف تصنيف|تصنيف جديد|فئة جديدة|قسم منتجات جديد)/.test(lower)) {
    return {
      name: "category_create",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["اعرض التصنيفات", "أضف منتج للتصنيف"],
    };
  }

  if (/(اعرض التصنيفات|التصنيفات|فئات المنتجات|اقسام المنتجات)/.test(lower)) {
    return {
      name: "category_list",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {},
      suggestions: ["أضف تصنيف", "أضف منتج"],
    };
  }

  if (/(أضف قسم|اضف قسم|قسم جديد)/.test(lower)) {
    return {
      name: "section_create",
      objective: message,
      taskType: "planning",
      confidence: 0.85,
      requiresPlanning: false,
      params: { name: extractQuotedText(message) || "قسم جديد" },
      suggestions: ["خطط لتنفيذ القسم", "لقطة للنظام"],
    };
  }

  if (/(أتمتة|واتساب|automation)/.test(lower) && /(زار|زيارة|مرات|form|حجز)/.test(lower)) {
    const visitCount = extractFirstNumber(message) || 3;
    const page =
      ["الأثاث", "المطابخ", "الغرف", "الموقع", "الصفحة"].find((item) => lower.includes(item)) ||
      "صفحة مهمة";
    return {
      name: "automation_rule",
      objective: message,
      taskType: "operations",
      confidence: 0.9,
      requiresPlanning: false,
      params: {
        name: `قاعدة أتمتة ${page}`,
        trigger: "page_visit",
        conditions: { page, visitCount: { gte: visitCount } },
        actions: [{ type: "whatsapp", message: `مرحباً، لاحظنا اهتمامك بـ ${page}. هل تريد استشارة؟` }],
      },
      suggestions: ["الموافقات", "الفرص", "المؤشرات"],
    };
  }

  if (/(غير|تغيير|عدّل|عدل)/.test(lower) && /(الخلفية|background)/.test(lower)) {
    const color = extractHexColor(message) || resolveNamedColor(message);
    return {
      name: "background_change",
      objective: message,
      taskType: "design",
      confidence: color ? 0.9 : 0.65,
      requiresPlanning: false,
      params: { color },
      suggestions: ["حالة الوكيل", "لقطة للنظام"],
    };
  }

  if (/(غير|تغيير|عدّل|عدل)/.test(lower) && /(لون|الألوان|الوان|theme|primary)/.test(lower)) {
    const color = extractHexColor(message) || resolveNamedColor(message);
    return {
      name: "theme_change",
      objective: message,
      taskType: "design",
      confidence: color ? 0.9 : 0.65,
      requiresPlanning: false,
      params: { color },
      suggestions: ["حالة الوكيل", "لقطة للنظام"],
    };
  }

  if (/(خطة|خطط|plan|roadmap)/.test(lower)) {
    return {
      name: "plan",
      objective: message,
      taskType: "planning",
      confidence: 0.9,
      requiresPlanning: true,
      params: {},
      suggestions: ["نفّذ الخطة", "أنشئ هدف"],
    };
  }

  if (/(أنشئ هدف|انشئ هدف|هدف جديد|goal)/.test(lower)) {
    return {
      name: "goal_create",
      objective: message,
      taskType: "planning",
      confidence: 0.85,
      requiresPlanning: false,
      params: {},
      suggestions: ["الخطط", "حالة الوكيل"],
    };
  }

  return null;
}

export async function initializeAgent(
  config?: Partial<AgentConfig>
): Promise<{ success: boolean; message: string; status: AgentStatus }> {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }

  await logAuditEvent("agent_initialization", "initialize", "system", { config: currentConfig }, "success");

  const status = await getAgentStatus();
  return {
    success: true,
    message: `Ultimate Agent "${currentConfig.name}" initialized`,
    status,
  };
}

export function getAgentConfig(): AgentConfig {
  return { ...currentConfig };
}

export async function updateAgentConfig(
  updates: Partial<AgentConfig>
): Promise<{ success: boolean; message: string }> {
  currentConfig = { ...currentConfig, ...updates };
  return { success: true, message: "Configuration updated" };
}

export async function getAgentStatus(): Promise<AgentStatus> {
  const [approvals, goals, securityStats, anomalies] = await Promise.all([
    getPendingApprovals(),
    getActiveGoals(),
    getSecurityStats(),
    detectAnomalies(),
  ]);

  agentStatus.lastCheck = new Date();
  agentStatus.nextCheck = new Date(Date.now() + currentConfig.checkIntervalMinutes * 60 * 1000);
  agentStatus.pendingApprovals = approvals.requests?.length || 0;
  agentStatus.goalsActive = goals.goals?.length || 0;
  agentStatus.actionsToday =
    (securityStats.stats?.approvedToday || 0) +
    (securityStats.stats?.rejectedToday || 0) +
    (securityStats.stats?.criticalActionsToday || 0);
  agentStatus.anomaliesDetected = anomalies.anomalies?.length || 0;
  agentStatus.mode = agentStatus.isActive ? "active" : "paused";
  agentStatus.modelMesh = buildModelMesh();
  agentStatus.capabilities = [...STATIC_CAPABILITIES];

  return { ...agentStatus };
}

export async function executeCommand(
  command: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  void context;
  try {
    const agent = new UltimateAgent();
    return await agent.processCommandInternal(command, "system");
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function processAIRequest(
  request: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  return executeCommand(request, context);
}

export async function processCommand(userMessage: string, userId: string): Promise<string> {
  const agent = new UltimateAgent();
  return agent.processCommand(userMessage, userId);
}

export async function runProactiveCheck(): Promise<CommandResult> {
  try {
    const startTime = Date.now();
    const [anomaliesResult, opportunitiesResult, metricsSnapshot, securityStats] = await Promise.all([
      detectAnomalies(),
      generateOpportunities(),
      getMetricsSnapshot(),
      getSecurityStats(),
    ]);

    const anomalies = anomaliesResult.anomalies || [];
    const opportunities = opportunitiesResult.opportunities || [];

    if (anomalies.length > 0) {
      await storeMemory({
        type: "anomaly",
        category: "proactive_check",
        content: `Detected ${anomalies.length} anomalies in proactive check`,
        priority: "high",
        context: { anomalies, timestamp: new Date().toISOString() },
      });
    }

    await logAuditEvent(
      "proactive_check",
      "run_proactive_check",
      "ultimate_agent",
      { anomaliesCount: anomalies.length, opportunitiesCount: opportunities.length },
      "success"
    );

    agentStatus.anomaliesDetected = anomalies.length;
    agentStatus.lastCheck = new Date();

    return {
      success: true,
      message: `تم الفحص الاستباقي. الشذوذ: ${anomalies.length} | الفرص: ${opportunities.length}.`,
      data: {
        anomalies,
        opportunities,
        metrics: metricsSnapshot.snapshot,
        security: securityStats.stats,
        executionTime: Date.now() - startTime,
      },
      suggestions: ["المؤشرات", "الفرص", "الشذوذ"],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await logAuditEvent(
      "proactive_check",
      "run_proactive_check",
      "ultimate_agent",
      { error: errorMsg },
      "failure"
    );
    return {
      success: false,
      message: `فشل الفحص الاستباقي: ${errorMsg}`,
    };
  }
}

export async function generateDailyReport(): Promise<CommandResult> {
  try {
    const [metrics, recommendations, security, goals] = await Promise.all([
      getMetricsSnapshot(),
      generateStrategicRecommendations(),
      getSecurityStats(),
      getActiveGoals(),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      metrics: metrics.snapshot,
      security: security.stats,
      activeGoals: goals.goals?.length || 0,
      recommendations: recommendations.recommendations || [],
      modelMesh: buildModelMesh(),
    };

    await storeMemory({
      type: "decision",
      category: "daily_report",
      content: `Daily report generated at ${report.generatedAt}`,
      priority: "normal",
      context: report,
    });

    return {
      success: true,
      message: `تقرير يومي:\n- الزوار: ${metrics.snapshot?.visitors.total || 0}\n- التحويلات: ${metrics.snapshot?.conversions.total || 0}\n- الاستفسارات: ${metrics.snapshot?.business.inquiries || 0}\n- الأهداف النشطة: ${report.activeGoals}`,
      data: report,
      suggestions: ["المؤشرات", "الفرص", "الشذوذ"],
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function handleApproval(
  requestId: string,
  approved: boolean,
  approvedBy: string,
  reason?: string
): Promise<CommandResult> {
  try {
    if (!requestId) {
      return { success: false, message: "Missing requestId" };
    }

    if (approved) {
      const approvalResult = await approveRequest(requestId, approvedBy);
      if (!approvalResult.success) {
        return {
          success: false,
          message: approvalResult.error || "Failed to process approval",
        };
      }

      await logAuditEvent(
        "approval_handling",
        "approve",
        approvedBy,
        { requestId, reason },
        "success"
      );

      await storeMemory({
        type: "learning",
        category: "feedback",
        content: `Approved action (ID: ${requestId})`,
        priority: "high",
        context: { requestId, approved: true, reason },
      });

      return {
        success: true,
        message: `تمت الموافقة على الطلب${approvalResult.executedAction ? ` وتم تنفيذ ${approvalResult.executedAction.type}` : ""}.`,
        actionTaken: approvalResult.executedAction?.type || "approval_granted",
        data: {
          requestId,
          approved: true,
          executedAction: approvalResult.executedAction,
        },
        suggestions: ["حالة الوكيل", "المؤشرات", "الفرص"],
      };
    }

    const rejectionResult = await rejectRequest(requestId, approvedBy, reason || "Rejected by user");
    if (!rejectionResult.success) {
      return {
        success: false,
        message: rejectionResult.error || "Failed to process rejection",
      };
    }

    await logAuditEvent("approval_handling", "reject", approvedBy, { requestId, reason }, "success");

    await storeMemory({
      type: "learning",
      category: "rejection",
      content: `User rejected request ${requestId}`,
      priority: "high",
      context: { requestId, approved: false, reason },
    });

    return {
      success: true,
      message: "تم رفض الطلب. سأتعامل معه كإشارة لتجنب اقتراح مشابه بلا داعٍ.",
      actionTaken: "approval_rejected",
      data: { requestId, approved: false },
      suggestions: ["الموافقات", "القدرات", "حالة الوكيل"],
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export class UltimateAgent {
  async processCommandWithResult(
    userMessage: string,
    userId: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
    relationContext?: RelationContext
  ): Promise<{
    reply: string;
    error?: string;
    requiresApproval?: boolean;
    approvalRequestId?: string;
    actionTaken?: string;
    suggestions?: string[];
    data?: unknown;
  }> {
    const result = await this.processCommandInternal(userMessage, userId, conversationHistory, relationContext);
    return {
      reply: result.message,
      error: result.success ? undefined : result.message,
      requiresApproval: result.requiresApproval,
      approvalRequestId: result.approvalRequestId,
      actionTaken: result.actionTaken,
      suggestions: result.suggestions,
      data: result.data,
    };
  }

  async processCommand(userMessage: string, userId: string): Promise<string> {
    const result = await this.processCommandInternal(userMessage, userId);
    return result.message;
  }

  async processCommandInternal(
    userMessage: string,
    userId: string,
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>,
    relationContext?: RelationContext
  ): Promise<CommandResult> {
    const startTime = Date.now();

    await storeMemory({
      type: "interaction",
      category: "conversation",
      content: userMessage,
      priority: "normal",
      context: { userId, role: "user" },
    }).catch(() => undefined);

    // TRUE AI ONLY - No fallbacks, no legacy systems
    // This is pure intelligence, not programmed responses
    try {
      const trueAgentResult = await processWithTrueAgent(userMessage, userId);
      
      // Store the interaction
      await storeMemory({
        type: "interaction",
        category: "conversation",
        content: trueAgentResult.message,
        priority: "normal",
        context: { 
          userId, 
          role: "assistant", 
          actionTaken: trueAgentResult.action || "reasoned_response",
          understanding: trueAgentResult.understanding,
        },
      }).catch(() => undefined);
      
      return {
        success: trueAgentResult.success,
        message: trueAgentResult.message,
        actionTaken: trueAgentResult.action || "reasoned_response",
        suggestions: trueAgentResult.suggestions,
        data: {
          understanding: trueAgentResult.understanding,
          reasoning: trueAgentResult.reasoning,
          ...trueAgentResult.data,
        },
      };
    } catch (error) {
      console.error("True Agent error:", error);
      
      // Last resort - simple conversational response, NO hardcoded patterns
      return {
        success: false,
        message: "واجهت مشكلة في التفكير. ممكن توضح أكتر؟",
        actionTaken: "error_fallback",
        suggestions: ["حاول تاني", "ساعدني"],
      };
    }
        executedTools.length > 0
          ? executedTools
              .slice(-4)
              .map((t) => `- ${t.name}: ${t.success ? "نجاح" : "فشل"} - ${t.message}`)
              .join("\n")
          : "- لم يتم تنفيذ أي أداة.";

      finalAnswer =
        `لم أستطع إنهاء الطلب خلال ${MAX_ITERATIONS} محاولات.\n` +
        `ملخص آخر ما حدث:\n${summaryLines}\n` +
        `اكتب المطلوب بشكل محدد وسأكمل (مع الرابط/الاسم/القيمة المطلوبة).`;
    }

    const safeFinalAnswer = typeof finalAnswer === "string" ? finalAnswer : JSON.stringify(finalAnswer);

    await storeMemory({
      type: "interaction",
      category: "conversation",
      content: safeFinalAnswer,
      priority: "normal",
      context: { userId, role: "assistant", actionTaken: loopActionTaken },
    }).catch(() => undefined);

    await logAuditEvent(
      "agent_command",
      "universal_mind_loop",
      userId,
      { message: userMessage, executionTime: Date.now() - startTime, iterations },
      executedTools.length > 0 && executedTools.some((t) => !t.success) ? "failure" : "success"
    );

    const loopSuccess = executedTools.length === 0 ? true : executedTools.every((t) => t.success);
    return {
      success: loopSuccess,
      message: safeFinalAnswer,
      actionTaken: loopActionTaken,
      suggestions: ["المؤشرات", "حالة الوكيل", "لقطة للنظام"],
    };
  }

  private async executeIntent(
    intent: InterpretedIntent,
    userMessage: string,
    userId: string,
    context: CommandContext,
    relationContext?: RelationContext
  ): Promise<CommandResult> {
    switch (intent.name) {
      case "greeting": {
        const name = context.userName ? ` ${context.userName}` : "";
        return {
          success: true,
          message:
            `أهلاً${name}. أنا نواة تنفيذ وتحليل داخل Azenith Living، ` +
            `مش مجرد شات. أقدر أحلل، أخطط، أشغّل أدوات، وأطلب موافقة قبل أي تغيير حساس.`,
          actionTaken: "greeting_sent",
        };
      }

      case "help": {
        return {
          success: true,
          message:
            `الأوامر المتاحة:\n` +
            `- "حلل SEO للموقع" - تحليل SEO حقيقي\n` +
            `- "أنشئ قسم جديد" - إنشاء قسم موقع\n` +
            `- "نسخة احتياطية" - نسخ احتياطي للبيانات\n` +
            `- "تحليل الإيرادات" - إحصائيات حقيقية\n` +
            `- "حالة الوكيل" - معلومات النظام`,
          actionTaken: "help_shown",
        };
      }

      case "status": {
        const status = await this.getAgentStatus();
        return {
          success: true,
          message: `حالة الوكيل: ${status.mode} | الموافقات المعلقة: ${status.pendingApprovals} | الأهداف: ${status.goalsActive}`,
          actionTaken: "status_reported",
          data: status,
        };
      }

      case "seo_audit": {
        const url = (intent.params.url as string) || "https://azenithliving.com";
        const result = await executeTool(
          "seo_analyze",
          { url },
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "seo_analyzed",
          data: result.data,
        };
      }

      case "section_create": {
        const result = await executeTool(
          "section_create",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "section_created",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: (result as { approvalId?: string }).approvalId,
        };
      }

      case "backup": {
        const result = await executeTool(
          "backup_create",
          {
            name: intent.params.name as string || `backup-${new Date().toISOString()}`,
            description: intent.params.description as string,
          },
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "backup_created",
          data: result.data,
        };
      }

      case "revenue_analysis": {
        const result = await executeTool(
          "revenue_analyze",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "revenue_analyzed",
          data: result.data,
        };
      }

      case "metrics": {
        const metrics = await getMetricsSnapshot();
        return {
          success: true,
          message: `المؤشرات:\n- زوار: ${metrics.snapshot?.visitors.total || 0}\n- تحويلات: ${metrics.snapshot?.conversions.total || 0}`,
          actionTaken: "metrics_reported",
          data: metrics.snapshot,
        };
      }

      case "anomalies": {
        const anomalies = await detectAnomalies();
        return {
          success: true,
          message: `الشذوذ المكتشف: ${anomalies.anomalies?.length || 0}`,
          actionTaken: "anomalies_reported",
          data: anomalies,
        };
      }

      case "opportunities": {
        const opportunities = await generateOpportunities();
        return {
          success: true,
          message: `الفرص المتاحة: ${opportunities.opportunities?.length || 0}`,
          actionTaken: "opportunities_reported",
          data: opportunities,
        };
      }

      case "plan": {
        return this.handlePlanningIntent(intent, userMessage, context, relationContext);
      }

      case "goal_create": {
        const goalResult = await createGoal({
          title: intent.params.title as string,
          description: intent.params.description as string,
          priority: "normal",
          status: "active",
          progress: 0,
          steps: [],
        });
        return {
          success: goalResult.success,
          message: goalResult.success ? `تم إنشاء الهدف: ${intent.params.title}` : (goalResult.error || "فشل إنشاء الهدف"),
          actionTaken: "goal_created",
          data: goalResult,
        };
      }

      // Product Management Cases
      case "product_list": {
        const result = await executeTool(
          "product_list",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "product_listed",
          data: result.data,
        };
      }

      case "product_create": {
        const result = await executeTool(
          "product_create",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          },
          { autoApprove: false }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "product_created",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: result.approvalRequestId,
        };
      }

      case "product_update": {
        const result = await executeTool(
          "product_update",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          },
          { autoApprove: false }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "product_updated",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: result.approvalRequestId,
        };
      }

      case "product_delete": {
        const result = await executeTool(
          "product_delete",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          },
          { autoApprove: false }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "product_deleted",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: result.approvalRequestId,
        };
      }

      case "product_get": {
        const result = await executeTool(
          "product_get",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "product_retrieved",
          data: result.data,
        };
      }

      case "category_list": {
        const result = await executeTool(
          "category_list",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "categories_listed",
          data: result.data,
        };
      }

      case "category_create": {
        const result = await executeTool(
          "category_create",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          },
          { autoApprove: false }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "category_created",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: result.approvalRequestId,
        };
      }

      case "inventory_check": {
        const result = await executeTool(
          "inventory_check_low",
          {},
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "inventory_checked",
          data: result.data,
        };
      }

      case "inventory_update": {
        const result = await executeTool(
          "inventory_update",
          intent.params,
          {
            companyId: relationContext?.companyId,
            actorUserId: userId,
            executionId: crypto.randomUUID(),
          },
          { autoApprove: false }
        );
        return {
          success: result.success,
          message: result.message,
          actionTaken: "inventory_updated",
          data: result.data,
          requiresApproval: result.requiresApproval,
          approvalRequestId: result.approvalRequestId,
        };
      }

      // Memory & Preferences
      case "preference_update": {
        const { name, info } = intent.params;
        
        if (name) {
          // Store user's name
          await storeMemory({
            type: "preference",
            category: "user_profile",
            content: name as string,
            priority: "high",
            context: { userId, preferenceKey: "name", role: "system" },
          }).catch(() => undefined);
          
          return {
            success: true,
            message: `تمام، هفكرك ${name} من دلوقت 😊`,
            actionTaken: "preference_stored",
            data: { name },
            suggestions: ["حالة الوكيل", "اعرض المنتجات"],
          };
        }
        
        if (info) {
          // Store general info
          await storeMemory({
            type: "learning",
            category: "user_info",
            content: info as string,
            priority: "normal",
            context: { userId, role: "system" },
          }).catch(() => undefined);
          
          return {
            success: true,
            message: `حفظت المعلومة: ${info}`,
            actionTaken: "info_stored",
            data: { info },
          };
        }
        
        return {
          success: true,
          message: "عايزني أحفظ إيه بالظبط؟",
          actionTaken: "asked_what_to_store",
          suggestions: ["احفظ اسمي", "تذكر أني..."],
        };
      }

      default: {
        return this.respondConversationally(userMessage, context, intent);
      }
    }
  }

  private async handlePlanningIntent(
    intent: InterpretedIntent,
    userMessage: string,
    context: CommandContext,
    relationContext?: RelationContext
  ): Promise<CommandResult> {
    const planResult = await plannerAgent.createPlan({ command: userMessage });

    return {
      success: planResult.success,
      message: planResult.success 
        ? `خطة مقترحة: ${planResult.plan?.goal || "بدون عنوان"}`
        : (planResult.error || "فشل إنشاء الخطة"),
      actionTaken: "plan_created",
      data: planResult,
      suggestions: ["نفذ الخطة", "عدل الخطة", "احفظ للمراجعة"],
    };
  }

  private async respondConversationally(
    userMessage: string,
    context: CommandContext,
    intent: InterpretedIntent
  ): Promise<CommandResult> {
    const prompt = [
      "أنت عقل عمليات حقيقي داخل لوحة تحكم إدارية، وليس مجرد مساعد دردشة.",
      "رد بالعربية المباشرة.",
      "إذا لم تكن هناك أداة مطلوبة الآن، فاشرح أفضل خطوة عملية تالية بوضوح.",
      `آخر الرسائل: ${context.recentMessages.join(" | ") || "لا يوجد"}`,
      `الأهداف النشطة: ${context.activeGoals.join(" | ") || "لا يوجد"}`,
      `رسالة المستخدم: ${userMessage}`,
    ].join("\n");

    const routed = await routeRequest({
      modelPreference: getBestModelForTask(intent.taskType || "general"),
      prompt,
      systemPrompt:
        "قدّم ردوداً قصيرة، صريحة، تنفيذية، وتجنب الادعاءات الخارقة أو الوعود غير الواقعية.",
      temperature: 0.3,
      maxTokens: 700,
    });

    let reply = "";

    if (routed.success && routed.content.trim()) {
      reply = routed.content.trim();
    } else {
      reply = buildLocalConversationalReply(userMessage, context);
    }

    return {
      success: true,
      message: reply,
      actionTaken: "conversational_reply",
      suggestions: normalizeSuggestions(intent.suggestions, ["حالة الوكيل", "المؤشرات", "خطط لمهمة جديدة"]),
      data: {
        intent: intent.name,
        model: routed.model || "deepseek-fallback",
      },
    };
  }

  async handleApproval(
    requestId: string,
    approved: boolean,
    approvedBy = "user",
    reason?: string
  ): Promise<CommandResult> {
    return handleApproval(requestId, approved, approvedBy, reason);
  }

  async getAgentStatus(): Promise<AgentStatus> {
    return getAgentStatus();
  }

  async runProactiveCheck(): Promise<CommandResult> {
    return runProactiveCheck();
  }
}

export { getPendingApprovals } from "./security-manager";
export { getActiveGoals, storeMemory } from "./memory-store";
export { detectAnomalies, generateOpportunities, getMetricsSnapshot } from "./predictive-engine";
