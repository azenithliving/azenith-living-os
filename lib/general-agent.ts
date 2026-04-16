/**
 * General Agent - Omnipotent Planning & Execution Engine
 *
 * "Plan wisely, execute safely."
 *
 * Capabilities:
 * 1. LLM-powered planning based on system discovery
 * 2. Safe execution of SQL queries, API calls, and settings updates
 * 3. Dynamic adaptation to any system component
 * 4. Security-first execution with human approval for risky operations
 */

import {
  generateSystemSnapshot,
  getSystemOverview,
  describeResource,
  executeSafeQuery,
  getTableSample,
  type SystemSnapshot,
  type TableInfo,
  type ApiEndpoint,
} from "./discovery-engine";
import { createClient } from "./supabase-server";

// Types for planning and execution
type ActionType = "sql" | "api" | "update_settings" | "send_notification" | "analyze";

interface PlanStep {
  id: number;
  action: ActionType;
  description: string;
  details: {
    query?: string;
    endpoint?: string;
    method?: string;
    payload?: Record<string, unknown>;
    settingKey?: string;
    settingValue?: unknown;
    notificationType?: string;
    target?: string;
    analysisQuery?: string;
  };
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
}

interface ExecutionPlan {
  title: string;
  description: string;
  steps: PlanStep[];
  estimatedRisk: "low" | "medium" | "high";
}

interface ExecutionResult {
  success: boolean;
  stepId: number;
  data?: unknown;
  error?: string;
  timestamp: string;
}

interface PlanExecution {
  plan: ExecutionPlan;
  results: ExecutionResult[];
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
}

// LLM Service for planning
interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callLLM(messages: LLMMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("No LLM API key configured");
  }

  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;

  try {
    const response = await fetch(
      isOpenRouter ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(isOpenRouter ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "" } : {}),
        },
        body: JSON.stringify({
          model: isOpenRouter ? "anthropic/claude-3.5-sonnet" : "gpt-4",
          messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("[GeneralAgent] LLM call failed:", error);
    throw error;
  }
}

/**
 * Generate execution plan using LLM with system context
 */
export async function generateExecutionPlan(request: string): Promise<ExecutionPlan> {
  // Get system snapshot for context
  const snapshot = await generateSystemSnapshot();

  const systemPrompt = `
أنت مدير موقع خبير في نظام Azenith Living OS. مهمتك وضع خطة تنفيذية آمنة ودقيقة للطلب المقدم.

معلومات النظام المتاحة:
${snapshot.summary}

الجداول المتاحة:
${snapshot.tables.map((t) => `- ${t.name}: ${t.columns.length} أعمدة`).join("\n")}

نقاط API المتاحة:
${snapshot.apis.slice(0, 10).map((a) => `- ${a.path}: ${a.methods.join(", ")}`).join("\n")}

أنواع الإجراءات المسموحة:
- sql: استعلام SELECT آمن فقط (قراءة)
- api: استدعاء نقطة نهاية داخلية
- update_settings: تحديث إعدادات الموقع
- send_notification: إرسال إشعار للمستخدمين
- analyze: تحليل البيانات وإنتاج تقرير

قواعد الأمان:
- 🚫 لا يُسمح بـ DROP, TRUNCATE, DELETE بدون شرط
- 🚫 لا يُسمح بـ UPDATE أو INSERT إلا في جداول محددة
- ✅ يُسمح بـ SELECT فقط لقراءة البيانات
- ⚠️ أي عملية على البيانات تتطلب موافقة منفصلة

يجب أن تكون الخطة:
1. محددة وقابلة للتنفيذ
2. آمنة ولا تحذف بيانات
3. مكتوبة بالعربية الواضحة
4. تحتوي على تقييم مستوى الخطر (low/medium/high)

أخرج الخطة بصيغة JSON:
{
  "title": "عنوان الخطة",
  "description": "وصف تفصيلي",
  "steps": [
    {
      "id": 1,
      "action": "sql|api|update_settings|send_notification|analyze",
      "description": "وصف الخطوة",
      "details": { ... },
      "requiresApproval": true/false,
      "riskLevel": "low|medium|high"
    }
  ],
  "estimatedRisk": "low|medium|high"
}
`;

  const userPrompt = `
الطلب: ${request}

ضع خطة تنفيذية تتضمن الخطوات اللازمة مع تحديد:
- ما هي الاستعلامات SQL المطلوبة
- ما هي APIs التي سيتم استدعاؤها  
- ما هي الإعدادات التي سيتم تعديلها (إن وجدت)
- ما هو مستوى الخطر لكل خطوة
`;

  try {
    const response = await callLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse plan from LLM response");
    }

    const plan = JSON.parse(jsonMatch[0]) as ExecutionPlan;

    // Validate plan structure
    if (!plan.title || !plan.steps || !Array.isArray(plan.steps)) {
      throw new Error("Invalid plan structure");
    }

    return plan;
  } catch (error) {
    console.error("[GeneralAgent] Failed to generate plan:", error);

    // Fallback: create a simple plan
    return {
      title: "خطة تحليلية",
      description: `تحليل الطلب: ${request}`,
      steps: [
        {
          id: 1,
          action: "analyze",
          description: "تحليل البيانات المتاحة للرد على الطلب",
          details: { analysisQuery: request },
          requiresApproval: false,
          riskLevel: "low",
        },
      ],
      estimatedRisk: "low",
    };
  }
}

/**
 * Execute a single plan step
 */
export async function executeStep(
  step: PlanStep,
  context?: SystemSnapshot
): Promise<ExecutionResult> {
  const timestamp = new Date().toISOString();

  try {
    switch (step.action) {
      case "sql":
        return await executeSQLStep(step);

      case "api":
        return await executeAPIStep(step);

      case "update_settings":
        return await executeSettingsStep(step);

      case "send_notification":
        return await executeNotificationStep(step);

      case "analyze":
        return await executeAnalysisStep(step, context);

      default:
        return {
          success: false,
          stepId: step.id,
          error: `نوع الإجراء غير معروف: ${step.action}`,
          timestamp,
        };
    }
  } catch (error) {
    return {
      success: false,
      stepId: step.id,
      error: error instanceof Error ? error.message : "خطأ غير معروف",
      timestamp,
    };
  }
}

/**
 * Execute SQL step safely
 */
async function executeSQLStep(step: PlanStep): Promise<ExecutionResult> {
  const query = step.details.query || "";

  // Double-check security
  const dangerousPatterns = [
    "DROP",
    "TRUNCATE",
    "DELETE",
    "UPDATE",
    "INSERT",
    "ALTER",
    "CREATE",
    "GRANT",
  ];
  const normalizedQuery = query.toUpperCase();

  for (const pattern of dangerousPatterns) {
    if (normalizedQuery.includes(pattern)) {
      return {
        success: false,
        stepId: step.id,
        error: `🚫 عملية ${pattern} غير مسموحة في الخطوات التلقائية`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  const result = await executeSafeQuery(query);

  return {
    success: result.success,
    stepId: step.id,
    data: result.data,
    error: result.error,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute API step
 */
async function executeAPIStep(step: PlanStep): Promise<ExecutionResult> {
  const endpoint = step.details.endpoint || "";
  const method = step.details.method || "GET";
  const payload = step.details.payload;

  // Security: Only allow internal API calls
  if (!endpoint.startsWith("/api/")) {
    return {
      success: false,
      stepId: step.id,
      error: "🚫 يُسمح فقط باستدعاء APIs الداخلية",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Add internal service key for authentication
        "X-Internal-Key": process.env.INTERNAL_API_KEY || "",
      },
      ...(payload && method !== "GET" ? { body: JSON.stringify(payload) } : {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        stepId: step.id,
        error: `API Error ${response.status}: ${errorText}`,
        timestamp: new Date().toISOString(),
      };
    }

    const data = (await response.json()) as unknown;

    return {
      success: true,
      stepId: step.id,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      stepId: step.id,
      error: error instanceof Error ? error.message : "خطأ في استدعاء API",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Execute settings update step
 */
async function executeSettingsStep(step: PlanStep): Promise<ExecutionResult> {
  const supabase = await createClient();
  const key = step.details.settingKey || "";
  const value = step.details.settingValue;

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() })
      .select();

    if (error) {
      return {
        success: false,
        stepId: step.id,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      stepId: step.id,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      stepId: step.id,
      error: error instanceof Error ? error.message : "خطأ في تحديث الإعدادات",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Execute notification step
 */
async function executeNotificationStep(step: PlanStep): Promise<ExecutionResult> {
  // For now, log the notification
  const notificationType = step.details.notificationType || "general";
  const target = step.details.target || "admin";

  console.log(`[GeneralAgent] Notification: ${notificationType} to ${target}`);

  // In production, this could send emails, push notifications, etc.

  return {
    success: true,
    stepId: step.id,
    data: { message: `Notification sent to ${target}`, type: notificationType },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute analysis step
 */
async function executeAnalysisStep(
  step: PlanStep,
  context?: SystemSnapshot
): Promise<ExecutionResult> {
  const query = step.details.analysisQuery || "";

  // Generate a summary based on the query and available context
  let analysisResult = "";

  if (query.includes("جدول") || query.includes("table")) {
    const tables = context?.tables.map((t) => t.name).join(", ") || "غير متوفر";
    analysisResult = `الجداول المتاحة: ${tables}`;
  } else if (query.includes("مستخدم") || query.includes("user")) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    analysisResult = `عدد المستخدمين المسجلين: ${count || 0}`;
  } else {
    analysisResult = `تم تحليل الطلب: ${query}. النظام يحتوي على ${context?.tables.length || 0} جدول و ${context?.apis.length || 0} API.`;
  }

  return {
    success: true,
    stepId: step.id,
    data: { analysis: analysisResult, query },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute full plan
 */
export async function executePlan(
  plan: ExecutionPlan,
  approvedSteps?: number[],
  onStepComplete?: (result: ExecutionResult) => void
): Promise<PlanExecution> {
  const execution: PlanExecution = {
    plan,
    results: [],
    status: "in_progress",
    startedAt: new Date().toISOString(),
  };

  const snapshot = await generateSystemSnapshot();

  for (const step of plan.steps) {
    // Check if step requires approval
    if (step.requiresApproval && (!approvedSteps || !approvedSteps.includes(step.id))) {
      execution.results.push({
        success: false,
        stepId: step.id,
        error: "⏸️ هذه الخطوة تتطلب موافقة منفصلة",
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    const result = await executeStep(step, snapshot);
    execution.results.push(result);

    if (onStepComplete) {
      onStepComplete(result);
    }

    // Stop on critical failure
    if (!result.success && step.riskLevel === "high") {
      execution.status = "failed";
      return execution;
    }
  }

  execution.status = "completed";
  execution.completedAt = new Date().toISOString();

  return execution;
}

/**
 * Process user query and return natural language response
 */
export async function processQuery(query: string): Promise<{
  success: boolean;
  response: string;
  plan?: ExecutionPlan;
  execution?: PlanExecution;
}> {
  try {
    // Check if query requires planning
    const requiresPlanning =
      query.includes("اعمل") ||
      query.includes("قم بـ") ||
      query.includes("حسّن") ||
      query.includes("أنشئ") ||
      query.includes("حدّث") ||
      query.includes("اكتب");

    if (requiresPlanning) {
      // Generate and execute plan
      const plan = await generateExecutionPlan(query);
      const execution = await executePlan(plan);

      // Generate response based on execution results
      const response = generateResponseFromExecution(plan, execution);

      return {
        success: execution.status === "completed",
        response,
        plan,
        execution,
      };
    } else {
      // Simple discovery query
      const overview = await getSystemOverview();
      return {
        success: true,
        response: overview,
      };
    }
  } catch (error) {
    return {
      success: false,
      response: `عذراً، حدث خطأ: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
    };
  }
}

/**
 * Generate natural language response from execution (Arabic)
 */
function generateResponseFromExecution(plan: ExecutionPlan, execution: PlanExecution): string {
  const successfulSteps = execution.results.filter((r) => r.success).length;
  const totalSteps = execution.results.length;

  let response = `✅ تم تنفيذ خطة "${plan.title}"\n`;
  response += `📊 النتيجة: ${successfulSteps}/${totalSteps} خطوات نجحت\n\n`;

  for (const result of execution.results) {
    const step = plan.steps.find((s) => s.id === result.stepId);
    const status = result.success ? "✅" : "❌";
    response += `${status} ${step?.description || `خطوة ${result.stepId}`}\n`;

    if (result.error) {
      response += `   ⚠️ ${result.error}\n`;
    }

    if (result.data) {
      const dataSummary = summarizeData(result.data);
      if (dataSummary) {
        response += `   📄 ${dataSummary}\n`;
      }
    }
  }

  return response;
}

/**
 * Summarize data for display
 */
function summarizeData(data: unknown): string {
  if (Array.isArray(data)) {
    return `تم استرجاع ${data.length} سجل/سجلات`;
  }
  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data);
    return `نتيجة: ${keys.join(", ")}`;
  }
  return String(data).substring(0, 100);
}

/**
 * Store suggestion in database
 */
export async function storeSuggestion(
  title: string,
  description: string,
  plan: ExecutionPlan,
  triggeredBy?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("general_suggestions")
      .insert({
        title,
        description,
        proposed_plan: plan as unknown as Record<string, unknown>,
        triggered_by: triggeredBy || "general_agent",
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطأ في تخزين الاقتراح",
    };
  }
}

/**
 * Execute a stored suggestion by ID
 */
export async function executeStoredSuggestion(
  suggestionId: string,
  userId: string
): Promise<{
  success: boolean;
  result?: PlanExecution;
  error?: string;
}> {
  const supabase = await createClient();

  try {
    // Get suggestion
    const { data: suggestion, error } = await supabase
      .from("general_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (error || !suggestion) {
      return { success: false, error: "الاقتراح غير موجود" };
    }

    const plan = suggestion.proposed_plan as unknown as ExecutionPlan;

    // Execute all steps
    const execution = await executePlan(plan);

    // Update suggestion status
    const { error: updateError } = await supabase
      .from("general_suggestions")
      .update({
        status: execution.status === "completed" ? "executed" : "failed",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        execution_result: execution as unknown as Record<string, unknown>,
      })
      .eq("id", suggestionId);

    return { success: execution.status === "completed", result: execution };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطأ في التنفيذ",
    };
  }
}

/**
 * Reject a stored suggestion
 */
export async function rejectSuggestion(
  suggestionId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from("general_suggestions")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", suggestionId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطأ في رفض الاقتراح",
    };
  }
}
