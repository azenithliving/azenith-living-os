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
  addProduct,
  analyzeRevenueOpportunities,
  analyzeSEO,
  checkContentHealth,
  createBackup,
  executeTool,
  TOOL_DEFINITIONS,
  generateAffiliateLinks,
  getSystemHealth,
  listProducts,
  optimizeSpeed,
  setupAdSense,
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

type IntentName =
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
  | "product_list"
  | "product_add"
  | "backup"
  | "speed_optimization"
  | "adsense_setup"
  | "affiliate_links"
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
  "تحليل SEO والمحتوى والإيرادات",
  "تخطيط مهام متعددة الخطوات",
  "إنشاء أهداف قابلة للمتابعة",
  "إنشاء قواعد أتمتة",
  "اقتراح وتنفيذ تغييرات الموقع بعد الموافقة",
  "تشغيل نسخ احتياطي وتحسين السرعة",
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

  const result = await executeTool(options.toolName, options.params);

  return {
    success: result.success,
    message: result.message,
    data: result.data,
    actionTaken: result.success ? options.successAction : `${options.successAction}_failed`,
    suggestions: normalizeSuggestions(options.fallbackSuggestions, ["المؤشرات", "التوصيات"]),
  };
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

  if (/(أضف منتج|اضف منتج|منتج جديد)/.test(lower)) {
    const name = extractQuotedText(message);
    const price = extractFirstNumber(message);
    return {
      name: "product_add",
      objective: message,
      taskType: "operations",
      confidence: 0.85,
      requiresPlanning: false,
      params: { name, price },
      suggestions: ["اعرض المنتجات", "المؤشرات"],
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

    const context = await buildCommandContext();

    // Check for hardcoded heuristic intents (only greetings/help/status - fastest path)
    const heuristicIntent = detectIntentHeuristically(userMessage);
    if (heuristicIntent && heuristicIntent.confidence >= 0.95 && ["greeting", "help", "status"].includes(heuristicIntent.name)) {
      const result = await this.executeIntent(heuristicIntent, userMessage, userId, context, relationContext);
      // Store response in memory so future messages have context
      await storeMemory({
        type: "interaction",
        category: "conversation",
        content: result.message,
        priority: "normal",
        context: { userId, role: "assistant", actionTaken: result.actionTaken },
      }).catch(() => undefined);
      return result;
    }

    // THE UNIVERSAL MIND - AUTONOMOUS ReAct LOOP
    let loopContext = "";
    let finalAnswer = "";
    const loopActionTaken = "autonomous_loop_completed";
    let iterations = 0;
    let lastAction = "";
    const MAX_ITERATIONS = 4;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // Build messages array for native chat format - MUCH better than packing in one prompt
      const systemMessage = `أنت مساعد ذكي لمنصة أزينث ليفينج. تجيب دائماً بصيغة JSON:
{
  "thought": "تفكيرك الداخلي",
  "action": "final_answer | اسم_الأداة",
  "params": { "answer": "ردك إذا final_answer" }
}

قواعد:
1. إذا قال المستخدم "نفذ" أو "اعمل" أو "شغّل"\u060c انظر لآخر شيء ذكرته في المحادثة ونفذه باستخدام الأداة المناسبة.
2. إذا كان المستخدم يسأل سؤالاً، ارد عليه مباشرةً باستخدام final_answer. لا تشغّل أدوات للإجابة على الأسئلة.
3. لا تكرر نفس الأداة مرتين.

الأدوات المتاحة:
${JSON.stringify(TOOL_DEFINITIONS.map(t => ({ name: t.name, description: t.description, params: t.parameters })), null, 2)}

خطوات التنفيذ السابقة:
${loopContext}`;

      // Build messages: system + real conversation history + current request
      const messages = [
        { role: "system" as const, content: systemMessage },
        ...(conversationHistory || []).slice(-10).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: userMessage },
      ];

      const response = await askGroqMessages(messages, {
        temperature: 0.1,
        maxTokens: 800,
        jsonMode: true
      });

      if (!response.success) {
        finalAnswer = "واجهت مشكلة في التفكير العميق. يرجى المحاولة مرة أخرى.";
        break;
      }

      const parsed = safeJsonParse<{ thought?: string; action?: string; params?: Record<string, unknown> }>(
        response.content
      );
      
      if (!parsed || !parsed.action) {
        // Fallback to conversational if it broke JSON
        const fallback = await this.respondConversationally(userMessage, context, { name: "general_chat", taskType: "general", objective: userMessage, confidence: 0.5, requiresPlanning: false, params: {}, suggestions: [] });
        finalAnswer = fallback.message;
        break;
      }

      loopContext += `\nThought: ${parsed.thought}\nAction: ${parsed.action}\nParams: ${JSON.stringify(parsed.params)}\n`;

      if (parsed.action === "final_answer") {
        const ans = parsed.params?.answer;
        if (typeof ans === "string") {
          finalAnswer = ans;
        } else if (ans) {
          finalAnswer = JSON.stringify(ans);
        } else {
          finalAnswer = parsed.thought || "اكتملت المهمة بنجاح.";
        }
        break;
      }

      // Prevent repeating the same tool twice in a row
      if (parsed.action === lastAction && parsed.action !== "final_answer") {
        // Force a final answer to break the loop
        finalAnswer = `تم تنفيذ ${parsed.action} بنجاح. للمتابعة يرجى تقديم مزيد من التفاصيل.`;
        break;
      }
      lastAction = parsed.action;

      // Execute tool
      const toolRes = await executeTool(parsed.action, parsed.params);
      loopContext += `Observation: ${toolRes.success ? "نجاح" : "فشل"} - ${toolRes.message}\n`;
    }

    if (iterations >= MAX_ITERATIONS && !finalAnswer) {
      // Use Groq to summarize what happened instead of dumping raw logs
      const summaryRes = await askGroq(
        `أنت مساعد ذكي. حاولت تنفيذ طلب المستخدم وهذا ما تم: ${loopContext}
لخص ما تم بجملة واحدة أو اثنتين بالعربية، وإذا كان هناك شيء ناقص من المستخدم (مثل رقم حساب) فاطلبه بوضوح.`,
        { temperature: 0.3, maxTokens: 300 }
      );
      finalAnswer = summaryRes.success && summaryRes.content
        ? summaryRes.content
        : "تم تنفيذ الطلب، هل تريد تفاصيل إضافية؟";
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
      "success"
    );

    return {
      success: true,
      message: finalAnswer,
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
          suggestions: normalizeSuggestions(intent.suggestions, ["حالة الوكيل", "المؤشرات", "لقطة للنظام"]),
          data: { intent: intent.name },
        };
      }

      case "help": {
        return {
          success: true,
          message: [
            "أقدر أتعامل فعلياً مع:",
            ...STATIC_CAPABILITIES.map((capability) => `- ${capability}`),
            "",
            "إذا أردت تغييراً فعلياً في الموقع أو الأتمتة فسأمرره عبر أدوات حقيقية وموافقة عند اللزوم.",
          ].join("\n"),
          actionTaken: "capabilities_listed",
          suggestions: normalizeSuggestions(intent.suggestions, ["المؤشرات", "الفرص", "خطط لمهمة جديدة"]),
          data: { capabilities: STATIC_CAPABILITIES, intent: intent.name },
        };
      }

      case "self_improvement": {
        const [status, snapshot] = await Promise.all([getAgentStatus(), generateSystemSnapshot()]);
        const planResult = await plannerAgent.createPlan({
          command:
            "تطوير قدرات الوكيل التنفيذي ليصبح أقل اعتماداً على الأوامر الصريحة وأكثر قدرة على الفهم والتخطيط والتنفيذ المرن",
          context: {
            userId,
            previousCommands: context.recentMessages,
            systemState: {
              modelMesh: buildModelMesh(),
              capabilities: STATIC_CAPABILITIES,
              tables: snapshot.tables.length,
              apis: snapshot.apis.length,
              pages: snapshot.pages.length,
            },
            constraints: [
              "أي زيادة قدرات يجب أن تكون حقيقية وليست ادعاء",
              "التنفيذ يحتاج أدوات أو نماذج أو مفاتيح API عند اللزوم",
              "حافظ على طلب الموافقة قبل التغييرات الحساسة",
            ],
          },
        });

        const plan = planResult.plan;
        const topSteps =
          plan?.subtasks
            .slice(0, 4)
            .map((task, index) => `${index + 1}. ${task.title} | ${task.assignedAgent}`)
            .join("\n") || "1. توسيع أدوات التنفيذ\n2. تحسين طبقة الفهم\n3. إضافة نماذج أقوى عند الحاجة";

        return {
          success: true,
          message: [
            "أيوه، أقدر أتحسن وأتزود، لكن ليس تلقائياً من لا شيء.",
            "التحسين الحقيقي عندي يتم عبر 3 محاور:",
            "- توسيع طبقة الفهم حتى لا أعتمد على أوامر محفوظة فقط",
            "- ربط أدوات وتنفيذات جديدة فعلياً داخل النظام",
            "- دمج نماذج أو APIs أقوى عندما توفري مفاتيحها",
            "",
            `الحالة الحالية: ${(status.modelMesh || [])
              .map((item) => `${item.provider}:${item.healthy ? "جاهز" : "ضعيف"}`)
              .join(" | ")}`,
            `نطاق النظام المكتشف الآن: ${snapshot.tables.length} جدول | ${snapshot.apis.length} API | ${snapshot.pages.length} صفحة`,
            "",
            "أولويات التطوير الفعلية:",
            topSteps,
            "",
            "إذا أردتِ، أقدر أبدأ فوراً بتوسيع الوكيل ليصبح أقل تقيداً بالأوامر وأكثر اعتماداً على التخطيط والاكتشاف الديناميكي.",
          ].join("\n"),
          actionTaken: "self_improvement_explained",
          suggestions: normalizeSuggestions(intent.suggestions, [
            "خطط لتطوير الوكيل",
            "وسّع طبقة الفهم للوكيل",
            "ادمج نماذج مجانية إضافية",
          ]),
          data: {
            intent: intent.name,
            status,
            roadmap: plan,
          },
        };
      }

      case "status": {
        const [status, health] = await Promise.all([getAgentStatus(), getSystemHealth()]);
        return {
          success: true,
          message: [
            "حالة الوكيل:",
            `- الوضع: ${status.mode}`,
            `- الموافقات المعلقة: ${status.pendingApprovals}`,
            `- الأهداف النشطة: ${status.goalsActive}`,
            `- الشذوذ المكتشف: ${status.anomaliesDetected}`,
            `- صحة النظام: ${health.message}`,
            `- شبكة النماذج: ${(status.modelMesh || [])
              .map((item) => `${item.provider}:${item.healthy ? "جاهز" : "ضعيف"}`)
              .join(" | ")}`,
          ].join("\n"),
          actionTaken: "status_reported",
          suggestions: normalizeSuggestions(intent.suggestions, ["المؤشرات", "الشذوذ", "الفرص"]),
          data: { status, health, intent: intent.name },
        };
      }

      case "metrics": {
        const metrics = await getMetricsSnapshot();
        if (!metrics.success || !metrics.snapshot) {
          return {
            success: false,
            message: metrics.error || "تعذر جلب المؤشرات.",
            actionTaken: "metrics_failed",
          };
        }
        return {
          success: true,
          message: [
            "المؤشرات الحالية:",
            `- الزوار: ${metrics.snapshot.visitors.total}`,
            `- الزوار الفريدون: ${metrics.snapshot.visitors.unique}`,
            `- التحويلات: ${metrics.snapshot.conversions.total}`,
            `- معدل التحويل: ${(metrics.snapshot.conversions.rate * 100).toFixed(2)}%`,
            `- الاستفسارات: ${metrics.snapshot.business.inquiries}`,
          ].join("\n"),
          actionTaken: "metrics_fetched",
          suggestions: normalizeSuggestions(intent.suggestions, ["الشذوذ", "الفرص", "تقرير يومي"]),
          data: { snapshot: metrics.snapshot, intent: intent.name },
        };
      }

      case "anomalies": {
        const anomalyResult = await detectAnomalies();
        const anomalies = anomalyResult.anomalies || [];
        return {
          success: anomalyResult.success,
          message:
            anomalies.length > 0
              ? `تم اكتشاف ${anomalies.length} شذوذ:\n${anomalies
                  .slice(0, 5)
                  .map(
                    (item) =>
                      `- ${item.metric}: انحراف ${(item.deviation * 100).toFixed(1)}% | ${item.suggestedAction || "بدون إجراء مقترح"}`
                  )
                  .join("\n")}`
              : "لا يوجد شذوذ حرج حالياً.",
          actionTaken: "anomalies_fetched",
          suggestions: normalizeSuggestions(intent.suggestions, ["المؤشرات", "الفرص", "لقطة للنظام"]),
          data: { anomalies, intent: intent.name },
        };
      }

      case "opportunities": {
        const [opportunitiesResult, recommendationsResult] = await Promise.all([
          generateOpportunities(),
          generateStrategicRecommendations(),
        ]);
        const opportunities = opportunitiesResult.opportunities || [];
        const recommendations = recommendationsResult.recommendations || [];
        return {
          success: opportunitiesResult.success,
          message: [
            `الفرص المكتشفة: ${opportunities.length}`,
            ...opportunities.slice(0, 3).map(
              (item, index) =>
                `${index + 1}. ${item.title} | تأثير ${item.impact} | جهد ${item.effort}`
            ),
            recommendations[0] ? `أعلى توصية الآن: ${recommendations[0].title}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          actionTaken: "opportunities_fetched",
          suggestions: normalizeSuggestions(intent.suggestions, ["المؤشرات", "تقرير يومي", "خطط لمهمة جديدة"]),
          data: { opportunities, recommendations, intent: intent.name },
        };
      }

      case "system_scan": {
        const snapshot = await generateSystemSnapshot();
        return {
          success: true,
          message: [
            "لقطة النظام:",
            `- الجداول: ${snapshot.tables.length}`,
            `- الـ APIs: ${snapshot.apis.length}`,
            `- الصفحات: ${snapshot.pages.filter((page) => page.type === "page").length}`,
            `- قواعد الأتمتة: ${snapshot.automationRules.length}`,
            `- أهم الجداول: ${snapshot.tables.slice(0, 5).map((table) => table.name).join(", ") || "لا يوجد"}`,
          ].join("\n"),
          actionTaken: "system_scanned",
          suggestions: normalizeSuggestions(intent.suggestions, ["المؤشرات", "الفرص", "الخطط"]),
          data: { snapshot, intent: intent.name },
        };
      }

      case "daily_report":
        return generateDailyReport();

      case "seo_audit": {
        const result = await analyzeSEO();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "seo_analyzed",
          suggestions: normalizeSuggestions(intent.suggestions, ["المحتوى", "حسّن السرعة", "الفرص"]),
        };
      }

      case "content_audit": {
        const result = await checkContentHealth();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "content_checked",
          suggestions: normalizeSuggestions(intent.suggestions, ["SEO audit", "الفرص", "المؤشرات"]),
        };
      }

      case "revenue_analysis": {
        const result = await analyzeRevenueOpportunities();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "revenue_analyzed",
          suggestions: normalizeSuggestions(intent.suggestions, ["الفرص", "المؤشرات", "تقرير يومي"]),
        };
      }

      case "plan": {
        const overview = await getSystemOverview();
        const planResult = await plannerAgent.createPlan({
          command: intent.objective || userMessage,
          context: {
            userId,
            previousCommands: context.recentMessages,
            systemState: { overview, activeGoals: context.activeGoals },
            constraints: ["استخدم أدوات حقيقية عند الإمكان", "اطلب موافقة قبل التعديلات الحساسة"],
          },
        });

        if (!planResult.success || !planResult.plan) {
          return {
            success: false,
            message: planResult.error || "تعذر إنشاء الخطة.",
            actionTaken: "plan_failed",
          };
        }

        return {
          success: true,
          message: summarizePlan(planResult.plan),
          data: { plan: planResult.plan, executionTime: planResult.executionTime, intent: intent.name },
          actionTaken: "plan_created",
          suggestions: normalizeSuggestions(intent.suggestions, ["أنشئ هدف", "عدّل الخطة", "لقطة للنظام"]),
        };
      }

      case "goal_create": {
        const title =
          extractQuotedText(userMessage) ||
          intent.objective.slice(0, 80) ||
          `هدف جديد ${new Date().toLocaleDateString("ar-EG")}`;
        const goal = await createGoal({
          title,
          description: userMessage,
          status: "active",
          priority: "high",
          progress: 0,
          steps: [
            { id: crypto.randomUUID(), description: "تحليل المطلوب", status: "pending", order: 1 },
            { id: crypto.randomUUID(), description: "التنفيذ", status: "pending", order: 2 },
            { id: crypto.randomUUID(), description: "المراجعة", status: "pending", order: 3 },
          ],
        });

        return {
          success: goal.success,
          message: goal.success ? `تم إنشاء الهدف: ${title}` : goal.error || "تعذر إنشاء الهدف.",
          data: { goalId: goal.id, intent: intent.name },
          actionTaken: goal.success ? "goal_created" : "goal_failed",
          suggestions: normalizeSuggestions(intent.suggestions, ["الخطط", "حالة الوكيل"]),
        };
      }

      case "theme_change": {
        const color = typeof intent.params.color === "string" ? intent.params.color : undefined;
        if (!color) {
          return {
            success: false,
            message: "حدد اللون بوضوح، مثلاً: غيّر اللون الأساسي إلى ذهبي أو #C5A059.",
            actionTaken: "theme_change_missing_color",
            suggestions: ["غيّر اللون الأساسي إلى ذهبي", "غيّر الخلفية إلى أسود"],
          };
        }

        return executeApprovedOrImmediateTool({
          action: buildToolApprovalAction(
            "site_theme_change",
            "database_write",
            `تغيير اللون الأساسي إلى ${color}`,
            { key: "theme", value: { primaryColor: color }, involves_users: true },
            "medium"
          ),
          toolName: "updateSiteSetting",
          params: { key: "theme", value: { primaryColor: color } },
          successAction: "theme_updated",
          fallbackSuggestions: intent.suggestions,
          relationContext,
        });
      }

      case "background_change": {
        const color = typeof intent.params.color === "string" ? intent.params.color : undefined;
        if (!color) {
          return {
            success: false,
            message: "حدد لون الخلفية صراحة، مثلاً: غيّر الخلفية إلى #0A0A0A أو أسود.",
            actionTaken: "background_change_missing_color",
            suggestions: ["غيّر الخلفية إلى أسود", "غيّر اللون الأساسي إلى ذهبي"],
          };
        }

        return executeApprovedOrImmediateTool({
          action: buildToolApprovalAction(
            "site_background_change",
            "database_write",
            `تغيير الخلفية إلى ${color}`,
            { key: "theme", value: { backgroundColor: color }, involves_users: true },
            "medium"
          ),
          toolName: "updateSiteSetting",
          params: { key: "theme", value: { backgroundColor: color } },
          successAction: "background_updated",
          fallbackSuggestions: intent.suggestions,
          relationContext,
        });
      }

      case "automation_rule": {
        const name = (intent.params.name as string) || "قاعدة أتمتة جديدة";
        const trigger =
          (intent.params.trigger as
            | "page_visit"
            | "form_submit"
            | "booking_status_changed"
            | "lead_updated"
            | "time_delay"
            | "user_registered") || "page_visit";
        const conditions = (intent.params.conditions as Record<string, unknown>) || {};
        const actions =
          (intent.params.actions as Array<{ type: string; message?: string; intent?: string }>) || [];

        return executeApprovedOrImmediateTool({
          action: buildToolApprovalAction(
            "create_automation_rule",
            "database_write",
            `إنشاء قاعدة أتمتة "${name}"`,
            { name, trigger, conditions, actions, bulk_update: false },
            "medium"
          ),
          toolName: "createAutomationRule",
          params: { name, trigger, conditions, actions, enabled: true },
          successAction: "automation_created",
          fallbackSuggestions: intent.suggestions,
          relationContext,
        });
      }

      case "section_create": {
        const name = (intent.params.name as string) || extractQuotedText(userMessage) || "قسم جديد";
        return executeApprovedOrImmediateTool({
          action: buildToolApprovalAction(
            "create_section",
            "database_write",
            `إنشاء قسم "${name}"`,
            { name, involves_users: true },
            "medium"
          ),
          toolName: "createSection",
          params: { name },
          successAction: "section_created",
          fallbackSuggestions: intent.suggestions,
          relationContext,
        });
      }

      case "product_list": {
        const result = await listProducts();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "products_listed",
          suggestions: normalizeSuggestions(intent.suggestions, ["أضف منتج", "المؤشرات"]),
        };
      }

      case "product_add": {
        const name = typeof intent.params.name === "string" ? intent.params.name : extractQuotedText(userMessage);
        const price =
          typeof intent.params.price === "number" ? intent.params.price : extractFirstNumber(userMessage);

        if (!name || !price) {
          return {
            success: false,
            message: "لإضافة منتج فعلياً أحتاج اسم المنتج وسعره. مثال: أضف منتج \"كرسي مودرن\" بسعر 1200.",
            actionTaken: "product_missing_fields",
            suggestions: ["اعرض المنتجات", "أضف منتج \"كرسي مودرن\" بسعر 1200"],
          };
        }

        const result = await addProduct({ name, price });
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: result.success ? "product_added" : "product_add_failed",
          suggestions: normalizeSuggestions(intent.suggestions, ["اعرض المنتجات", "المؤشرات"]),
        };
      }

      case "backup": {
        const result = await createBackup();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "backup_created",
          suggestions: normalizeSuggestions(intent.suggestions, ["حالة الوكيل", "لقطة للنظام"]),
        };
      }

      case "speed_optimization": {
        const result = await optimizeSpeed();
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "speed_optimized",
          suggestions: normalizeSuggestions(intent.suggestions, ["SEO audit", "المؤشرات", "الفرص"]),
        };
      }

      case "adsense_setup": {
        const accountId = (intent.params.accountId as string) || extractQuotedText(userMessage);
        if (!accountId) {
          return {
            success: false,
            message: "أرسل `accountId` بوضوح لتفعيل AdSense.",
            actionTaken: "adsense_missing_account",
            suggestions: ["فعّل AdSense بالحساب \"pub-xxxx\""],
          };
        }
        const result = await setupAdSense(accountId);
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "adsense_setup",
          suggestions: ["المؤشرات", "الفرص"],
        };
      }

      case "affiliate_links": {
        const partners = userMessage
          .split(/[,\n]/)
          .map((item) => item.trim())
          .filter((item) => item && !/(رابط|affiliate|link|أنشئ|اعمل)/i.test(item));

        if (partners.length === 0) {
          return {
            success: false,
            message: "اذكر أسماء الشركاء مفصولة بفواصل لأولد روابط الإحالة.",
            actionTaken: "affiliate_missing_partners",
            suggestions: ["أنشئ روابط إحالة لـ IKEA, Amazon, Noon"],
          };
        }

        const result = await generateAffiliateLinks(partners);
        return {
          success: result.success,
          message: result.message,
          data: result.data,
          actionTaken: "affiliate_links_generated",
          suggestions: ["الفرص", "المؤشرات"],
        };
      }

      case "general_chat":
      default:
        return this.respondConversationally(userMessage, context, intent);
    }
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
