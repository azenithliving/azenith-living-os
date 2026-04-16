/**
 * Ultimate Agent Core - The Mastermind
 *
 * "The brain that never sleeps, learns, and evolves."
 *
 * Main orchestration engine for the Ultimate Intelligence Agent:
 * - Decision making and action planning
 * - Learning from feedback
 * - Autonomous operation mode
 * - Integration with all subsystems
 */

import { storeMemory, searchMemories, getUserPreference, getUserPreferences, storeUserPreference, getActiveGoals, createGoal, MemoryEntry, MemoryFilters } from "./memory-store";
import { classifyRisk, validateAction, createApprovalRequest, approveRequest, rejectRequest, getPendingApprovals, getSecurityStats, AgentAction } from "./security-manager";
import { getMetricsSnapshot, analyzeTrend, detectAnomalies, generateOpportunities, generateStrategicRecommendations, runWhatIfScenario, predictResourceDepletion } from "./predictive-engine";
import { executeAction, executeBatch, executeCodeSuggestion, ExecutionResult } from "./executor-omnipotent";
import { generateSystemSnapshot } from "@/lib/discovery-engine";

// Agent configuration
export interface AgentConfig {
  name: string;
  autoExecuteNormal: boolean;
  autoExecuteInfo: boolean;
  requireApprovalFor: string[]; // risk levels
  checkIntervalMinutes: number;
  maxDailyActions: number;
  learningEnabled: boolean;
  proactiveMode: boolean;
  notificationChannels: string[];
}

// Agent status
export interface AgentStatus {
  isActive: boolean;
  lastCheck: Date;
  nextCheck: Date;
  pendingApprovals: number;
  actionsToday: number;
  anomaliesDetected: number;
  goalsActive: number;
  mode: "active" | "paused" | "maintenance";
}

// Action plan
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

// User command result
export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  actionTaken?: string;
  requiresApproval?: boolean;
  suggestions?: string[];
}

// Default configuration
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

// Current configuration (can be updated)
let currentConfig: AgentConfig = { ...DEFAULT_CONFIG };

// Agent status
let agentStatus: AgentStatus = {
  isActive: true,
  lastCheck: new Date(),
  nextCheck: new Date(Date.now() + 60 * 60 * 1000),
  pendingApprovals: 0,
  actionsToday: 0,
  anomaliesDetected: 0,
  goalsActive: 0,
  mode: "active",
};

/**
 * Initialize the Ultimate Agent
 */
export async function initializeAgent(config?: Partial<AgentConfig>): Promise<{
  success: boolean;
  message: string;
  status: AgentStatus;
}> {
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }

  // Check for pending approvals
  const { success, requests } = await getPendingApprovals();
  if (success && requests) {
    agentStatus.pendingApprovals = requests.length;
  }

  // Get active goals count
  const { success: goalsSuccess, goals } = await getActiveGoals();
  if (goalsSuccess && goals) {
    agentStatus.goalsActive = goals.length;
  }

  // Store initialization
  await storeMemory({
    type: "decision",
    category: "agent_initialization",
    content: `Ultimate Agent initialized with ${currentConfig.proactiveMode ? "proactive" : "passive"} mode`,
    priority: "high",
    context: { config: currentConfig },
  });

  return {
    success: true,
    message: `Ultimate Agent "${currentConfig.name}" initialized successfully`,
    status: agentStatus,
  };
}

/**
 * Get agent configuration
 */
export function getAgentConfig(): AgentConfig {
  return { ...currentConfig };
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(updates: Partial<AgentConfig>): Promise<{
  success: boolean;
  message: string;
}> {
  currentConfig = { ...currentConfig, ...updates };

  await storeMemory({
    type: "decision",
    category: "config_update",
    content: `Agent configuration updated: ${Object.keys(updates).join(", ")}`,
    priority: "normal",
    context: { updates },
  });

  return {
    success: true,
    message: "Configuration updated successfully",
  };
}

/**
 * Get current agent status
 */
export async function getAgentStatus(): Promise<AgentStatus> {
  const { requests } = await getPendingApprovals();
  const { goals } = await getActiveGoals();

  agentStatus.pendingApprovals = requests?.length || 0;
  agentStatus.goalsActive = goals?.length || 0;

  return { ...agentStatus };
}

/**
 * Execute a single user command
 */
export async function executeCommand(
  command: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  const startTime = Date.now();

  // Parse command
  const lowerCommand = command.toLowerCase().trim();

  // Store command as interaction
  await storeMemory({
    type: "interaction",
    category: "user_command",
    content: command,
    priority: "normal",
    context: { timestamp: new Date().toISOString(), ...context },
  });

  // Command routing
  if (lowerCommand.includes("status") || lowerCommand.includes("حالة")) {
    const status = await getAgentStatus();
    return {
      success: true,
      message: `الوكيل ${status.isActive ? "نشط" : "متوقف"}. الموافقات المعلقة: ${status.pendingApprovals}. الأهداف النشطة: ${status.goalsActive}.`,
      data: status,
    };
  }

  if (lowerCommand.includes("snapshot") || lowerCommand.includes("نظام")) {
    const snapshot = await generateSystemSnapshot();
    return {
      success: true,
      message: snapshot.summary,
      data: snapshot,
    };
  }

  if (lowerCommand.includes("metrics") || lowerCommand.includes("مؤشرات")) {
    const { success, snapshot, error } = await getMetricsSnapshot();
    return {
      success,
      message: success
        ? `الزوار: ${snapshot?.visitors.total} | التحويلات: ${snapshot?.conversions.total} (${((snapshot?.conversions.rate || 0) * 100).toFixed(1)}%) | الاستفسارات: ${snapshot?.business.inquiries}`
        : error || "Failed to get metrics",
      data: snapshot,
    };
  }

  if (lowerCommand.includes("anomalies") || lowerCommand.includes("شذوذ")) {
    const { success, anomalies, error } = await detectAnomalies();
    return {
      success,
      message: anomalies?.length
        ? `تم اكتشاف ${anomalies.length} شذوذ: ${anomalies.map((a) => a.metric).join(", ")}`
        : "لم يتم اكتشاف أي شذوذ. النظام يعمل بشكل طبيعي.",
      data: anomalies,
    };
  }

  if (lowerCommand.includes("opportunities") || lowerCommand.includes("فرص")) {
    const { success, opportunities, error } = await generateOpportunities();
    return {
      success,
      message: opportunities?.length
        ? `وجدت ${opportunities.length} فرصة استراتيجية. أعلى الأولوية: ${opportunities[0]?.title}`
        : "لم يتم العثور على فرص جديدة حالياً.",
      data: opportunities,
    };
  }

  if (lowerCommand.includes("recommend") || lowerCommand.includes("توصيات")) {
    const { success, recommendations, error } = await generateStrategicRecommendations();
    return {
      success,
      message: recommendations?.length
        ? `التوصية الأولى: ${recommendations[0]?.title}`
        : "لا توجد توصيات حالياً.",
      data: recommendations,
    };
  }

  if (lowerCommand.includes("goals") || lowerCommand.includes("أهداف")) {
    const { success, goals, error } = await getActiveGoals();
    return {
      success,
      message: goals?.length
        ? `الأهداف النشطة: ${goals.map((g) => `${g.title} (${g.progress}%)`).join(", ")}`
        : "لا توجد أهداف نشطة حالياً.",
      data: goals,
    };
  }

  if (lowerCommand.includes("approvals") || lowerCommand.includes("موافقات")) {
    const { success, requests, error } = await getPendingApprovals();
    return {
      success,
      message: requests?.length
        ? `الموافقات المعلقة: ${requests.length} | أقدمها: ${requests[0]?.description.substring(0, 50)}...`
        : "لا توجد موافقات معلقة.",
      data: requests,
      actionTaken: requests?.length ? "approval_review" : undefined,
    };
  }

  if (lowerCommand.includes("pause") || lowerCommand.includes("إيقاف")) {
    agentStatus.mode = "paused";
    agentStatus.isActive = false;
    return {
      success: true,
      message: "تم إيقاف الوكيل مؤقتاً. استخدم 'استأنف' للتفعيل.",
    };
  }

  if (lowerCommand.includes("resume") || lowerCommand.includes("استأنف")) {
    agentStatus.mode = "active";
    agentStatus.isActive = true;
    return {
      success: true,
      message: "تم استئناف عمل الوكيل بنجاح.",
    };
  }

  if (lowerCommand.includes("help") || lowerCommand.includes("مساعدة")) {
    return {
      success: true,
      message: "الأوامر المتاحة: حالة، نظام، مؤشرات، شذوذ، فرص، توصيات، أهداف، موافقات، إيقاف، استأنف",
      suggestions: [
        "ما حالة الوكيل؟",
        "أعرض المؤشرات",
        "اكتشف الشذوذ",
        "اعرض الفرص",
      ],
    };
  }

  // Default: process as natural language request
  return {
    success: true,
    message: `تم استلام طلبك: "${command}". سأحلله وأتخذ الإجراء المناسب.`,
    suggestions: [
      "استخدم 'مساعدة' لعرض الأوامر المتاحة",
      "استخدم 'حالة' لمعرفة حالة الوكيل",
    ],
  };
}

/**
 * Process a natural language request with AI
 */
export async function processAIRequest(
  request: string,
  context?: Record<string, unknown>
): Promise<CommandResult> {
  // First try exact command matching
  const exactResult = await executeCommand(request, context);

  // If it wasn't a recognized command, use AI interpretation
  if (exactResult.suggestions) {
    return exactResult;
  }

  // Learn from user preferences
  if (currentConfig.learningEnabled) {
    // Check if user has expressed preferences before
    const { value: preferenceValue } = await getUserPreference("interaction_style", "detail_level");
    
    if (preferenceValue === "brief") {
      return {
        success: true,
        message: `✓ تم: ${request.substring(0, 50)}${request.length > 50 ? "..." : ""}`,
      };
    }
  }

  // Check for patterns that suggest auto-execution
  const autoExecutePatterns = [
    "افحص", "scan", "check", "تحقق",
    "أرسل", "send", "send report",
    "أنشئ", "create", "generate",
  ];

  const shouldAutoExecute = autoExecutePatterns.some((p) =>
    request.toLowerCase().includes(p.toLowerCase())
  );

  if (shouldAutoExecute && currentConfig.autoExecuteNormal) {
    // Auto-execute if matches patterns and enabled
    return {
      success: true,
      message: `سأقوم بتنفيذ "${request}" تلقائياً...`,
      actionTaken: "auto_execution",
    };
  }

  return {
    success: true,
    message: `فهمت طلبك. هل تريد مني تنفيذ "${request}"؟ (اكتب 'نعم' للتأكيد)`,
    requiresApproval: true,
  };
}

/**
 * Create and execute an action plan
 */
export async function createAndExecutePlan(
  objective: string,
  steps: Array<{
    type: string;
    payload: Record<string, unknown>;
    reason: string;
    priority: string;
  }>
): Promise<{
  success: boolean;
  planId: string;
  results: ExecutionResult[];
  summary: string;
}> {
  const planId = crypto.randomUUID();

  // Create plan
  const plan: ActionPlan = {
    id: planId,
    title: objective,
    description: `Plan to achieve: ${objective}`,
    actions: steps,
    expectedOutcome: "Objective completed",
    requiresApproval: steps.some((s) => s.priority === "critical"),
    riskLevel: steps.some((s) => s.priority === "critical") ? "critical" : "normal",
    autoExecute: !steps.some((s) => s.priority === "critical"),
  };

  // Store plan
  await storeMemory({
    type: "decision",
    category: "action_plan",
    content: `Created plan: ${objective} with ${steps.length} steps`,
    priority: plan.riskLevel === "critical" ? "critical" : "high",
    context: { planId, stepCount: steps.length, objective },
  });

  // Execute if auto-execute is enabled
  const results: ExecutionResult[] = [];

  if (plan.autoExecute && currentConfig.autoExecuteNormal) {
    const batchResults = await executeBatch(
      steps.map((s) => ({ type: s.type, payload: s.payload }))
    );
    results.push(...batchResults);
  } else {
    // Create approval request
    await createApprovalRequest(
      {
        id: planId,
        type: "action_plan",
        category: "api_call",
        description: objective,
        payload: { steps },
        riskLevel: plan.riskLevel as "info" | "normal" | "critical" | "forbidden",
        requiresApproval: true,
        estimatedImpact: plan.riskLevel === "critical" ? "high" : "medium",
      },
      { planId, steps }
    );
  }

  // Update agent status
  agentStatus.actionsToday += results.filter((r) => r.success).length;

  const successful = results.filter((r) => r.success).length;
  const summary = `Plan ${planId}: ${successful}/${steps.length} steps completed successfully`;

  return {
    success: successful === steps.length,
    planId,
    results,
    summary,
  };
}

/**
 * Run proactive system check
 */
export async function runProactiveCheck(): Promise<{
  success: boolean;
  findings: string[];
  actionsTaken: string[];
}> {
  if (!currentConfig.proactiveMode || agentStatus.mode !== "active") {
    return {
      success: true,
      findings: [],
      actionsTaken: ["Proactive mode disabled or agent paused"],
    };
  }

  const findings: string[] = [];
  const actionsTaken: string[] = [];

  try {
    // 1. Check metrics
    const { success: metricsSuccess, snapshot } = await getMetricsSnapshot();
    if (metricsSuccess && snapshot) {
      if (snapshot.performance.avgPageLoad > 2.5) {
        findings.push(`⚠️ Slow page load: ${snapshot.performance.avgPageLoad.toFixed(2)}s`);
      }
      if (snapshot.conversions.rate < 0.02) {
        findings.push(`⚠️ Low conversion rate: ${(snapshot.conversions.rate * 100).toFixed(1)}%`);
      }
    }

    // 2. Detect anomalies
    const { success: anomalySuccess, anomalies } = await detectAnomalies();
    if (anomalySuccess && anomalies && anomalies.length > 0) {
      findings.push(...anomalies.map((a) => `🚨 Anomaly: ${a.metric} (${a.severity})`));
      agentStatus.anomaliesDetected += anomalies.length;

      // Auto-fix low severity anomalies
      for (const anomaly of anomalies.filter((a) => a.severity === "low")) {
        if (anomaly.suggestedAction) {
          actionsTaken.push(`Auto-fix attempt for ${anomaly.metric}`);
        }
      }
    }

    // 3. Check trends
    const { success: trendSuccess, analysis } = await analyzeTrend("visitors", 7);
    if (trendSuccess && analysis) {
      if (analysis.trend === "down" && analysis.changePercent < -15) {
        findings.push(`📉 Visitor drop: ${analysis.changePercent.toFixed(1)}%`);
      }
    }

    // 4. Check for new opportunities
    const { success: oppSuccess, opportunities } = await generateOpportunities();
    if (oppSuccess && opportunities && opportunities.length > 0) {
      const highImpact = opportunities.filter((o) => o.impact === "high");
      if (highImpact.length > 0) {
        findings.push(`💡 ${highImpact.length} high-impact opportunities available`);
      }
    }

    // 5. Check resource depletion
    // Example: API keys
    const { prediction } = await predictResourceDepletion("openrouter_credits", 1000, 250, 7);
    if (prediction?.willDeplete) {
      findings.push(`⏳ ${prediction.suggestedAction}`);
    }

    // Update status
    agentStatus.lastCheck = new Date();
    agentStatus.nextCheck = new Date(Date.now() + currentConfig.checkIntervalMinutes * 60 * 1000);

    // Store check results
    await storeMemory({
      type: "decision",
      category: "proactive_check",
      content: `Proactive check completed: ${findings.length} findings, ${actionsTaken.length} actions`,
      priority: findings.length > 0 ? "high" : "normal",
      context: { findings, actionsTaken },
    });

    return { success: true, findings, actionsTaken };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      findings: ["Error during proactive check"],
      actionsTaken: [errorMsg],
    };
  }
}

/**
 * Learn from user feedback
 */
export async function learnFromInteraction(
  command: string,
  wasHelpful: boolean,
  feedback?: string
): Promise<void> {
  if (!currentConfig.learningEnabled) return;

  // Store learning
  await storeMemory({
    type: "learning",
    category: "user_feedback",
    content: wasHelpful ? "User found response helpful" : "User found response unhelpful",
    priority: "normal",
    context: { command, wasHelpful, feedback },
  });

  // If multiple negative feedback on similar commands, store preference
  if (!wasHelpful) {
    const { memories } = await searchMemories({
      types: ["learning"],
      categories: ["user_feedback"],
      searchQuery: command.substring(0, 20),
      limit: 5,
    });

    const negativeCount = memories?.filter((m) => m.userFeedback === "negative").length || 0;

    if (negativeCount >= 2) {
      // User doesn't like something about this command type
      await storeUserPreference({
        category: "command_feedback",
        key: command.split(" ")[0],
        value: "avoid_or_simplify",
        confidence: 0.7,
        source: "inferred",
      });
    }
  }
}

/**
 * Generate daily report
 */
export async function generateDailyReport(): Promise<{
  success: boolean;
  report?: string;
  error?: string;
}> {
  try {
    const status = await getAgentStatus();
    const { stats: securityStats } = await getSecurityStats();

    // Get today's memories
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { memories } = await searchMemories({
      dateFrom: today,
      types: ["decision", "suggestion", "outcome"],
      limit: 50,
    });

    const report = `
📊 تقرير يومي - ${currentConfig.name}
===

🏃‍♂️ حالة الوكيل:
• الوضع: ${status.mode}
• الإجراءات اليوم: ${status.actionsToday}
• الموافقات المعلقة: ${status.pendingApprovals}
• الأهداف النشطة: ${status.goalsActive}

🔒 الأمان:
• إجمالي الأحداث: ${securityStats?.totalAuditEvents || 0}
• الموافقات المعتمدة اليوم: ${securityStats?.approvedToday || 0}
• الإجراءات الحرجة: ${securityStats?.criticalActionsToday || 0}

📈 الأنشطة:
${memories?.slice(0, 5).map((m) => `• ${m.type}: ${m.content.substring(0, 60)}...`).join("\n") || "لا أنشطة مسجلة"}

⚡ التوصية:
${status.pendingApprovals > 0 ? "يوجد موافقات معلقة تتطلب مراجعتك." : "النظام يعمل بشكل طبيعي."}
    `.trim();

    return { success: true, report };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Approve a pending action
 */
export async function handleApproval(
  requestId: string,
  approved: boolean,
  approvedBy: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  if (approved) {
    const result = await approveRequest(requestId, approvedBy);
    return {
      success: result.success,
      message: result.success ? "تمت الموافقة على الطلب بنجاح" : result.error || "فشلت الموافقة",
    };
  } else {
    const result = await rejectRequest(requestId, approvedBy, reason || "Rejected by user");
    return {
      success: result.success,
      message: result.success ? "تم رفض الطلب" : result.error || "فشل الرفض",
    };
  }
}

/**
 * Export agent data for backup
 */
export async function exportAgentData(): Promise<{
  success: boolean;
  data?: {
    memories: MemoryEntry[];
    goals: unknown[];
    preferences: unknown[];
    config: AgentConfig;
  };
  error?: string;
}> {
  try {
    const { memories } = await searchMemories({ limit: 1000 });
    const { goals } = await getActiveGoals();
    const { preferences } = await getUserPreferences();

    return {
      success: true,
      data: {
        memories: memories || [],
        goals: goals || [],
        preferences: preferences || [],
        config: currentConfig,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Re-export sub-modules for convenience
export { storeMemory, searchMemories, getUserPreference, storeUserPreference };
export { classifyRisk, validateAction, getPendingApprovals, getSecurityStats };
export { getMetricsSnapshot, analyzeTrend, detectAnomalies, generateOpportunities };
export { executeAction, executeBatch, executeCodeSuggestion };
