/**
 * True AI Reasoning Core
 * NOT programmed responses - but genuine reasoning
 */

import { routeRequest } from "@/lib/openrouter-service";
import { getBestModelForTask } from "@/lib/openrouter-service";
import { executeTool, TOOL_DEFINITIONS } from "@/lib/real-tool-executor";
import { storeMemory, getRecentMemories } from "./memory-store";

export interface ReasoningContext {
  userMessage: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userId: string;
  availableTools: typeof TOOL_DEFINITIONS;
  previousReasoning?: string;
}

export interface ReasoningResult {
  understanding: string;      // What the user actually wants
  intent: string;              // Inferred intent (not regex matched)
  requiredInfo: string[];     // What's needed to proceed
  missingInfo: string[];      // What's unclear
  selectedTool?: string;      // Which tool to use (if any)
  toolParams?: Record<string, unknown>;
  confidence: number;        // How sure we are (0-1)
  reasoning: string;          // The thought process
  response: string;           // What to say to user
  needsClarification: boolean;
  canExecute: boolean;
}

/**
 * Main reasoning function - the brain of the agent
 */
export async function reason(
  context: ReasoningContext
): Promise<ReasoningResult> {
  
  // Get relevant memories for context
  const memories = await getRecentMemories(5, ["interaction", "decision", "preference"]);
  const memoryContext = memories.memories?.map(m => m.content).join("\n") || "";

  const reasoningPrompt = `
أنت كيان ذكي حقيقي، لست برنامجًا مبرمجًا مسبقًا. حلل طلب المستخدم بعمق.

### سياق المحادثة:
${context.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join("\n")}

### ذكريات ذات صلة:
${memoryContext}

### الأدوات المتاحة:
${TOOL_DEFINITIONS.map(t => `- ${t.name}: ${t.description}`).join("\n")}

### رسالة المستخدم:
"${context.userMessage}"

### تحليلك المطلوب:
1. **فهم المقصود**: ماذا يريد المستخدم فعليًا؟ (ليست كلماته بل مقصده)
2. **النية**: ما الهدف الحقيقي؟
3. **المعلومات المتوفرة**: ما الذي عرفته من رسالته؟
4. **المعلومات الناقصة**: ما الذي محتاج توضيح؟
5. **الأداة المناسبة**: أي أداة (إن وجدت) تخدم هدفه؟
6. **الثقة**: مدى ثقتك في فهمك (0-1)

### أمثلة على التفكير الحر:

**مثال 1 - تخزين اسم:**
- المستخدم: "اسمي سليم"
- الفهم: يريدني أن أعرفه وأحفظ اسمه
- النية: تخزين هوية
- ليست: إنشاء منتج!

**مثال 2 - إضافة منتج:**
- المستخدم: "عندي كنبة جديدة بـ 5000"
- الفهم: يخبرني عن منتج يريد إضافته
- النية: إنشاء منتج
- الأداة: product_create
- المعاملات: {name: "كنبة", price: 5000}

**مثال 3 - غموض:**
- المستخدم: "نفذ"
- الفهم: يريد شيئًا ما لكن غامض
- النية: غير واضحة
- يحتاج: توضيح

أجب بـ JSON:
{
  "understanding": "شرح ما فهمته",
  "intent": "النية الحقيقية",
  "requiredInfo": ["معلومة1", "معلومة2"],
  "missingInfo": ["ناقص1"],
  "selectedTool": "اسم_الأداة_أو_null",
  "toolParams": {},
  "confidence": 0.9,
  "reasoning": "تفكيرك النقدي",
  "response": "ما ستقوله للمستخدم",
  "needsClarification": false,
  "canExecute": true
}`;

  try {
    const response = await routeRequest({
      modelPreference: getBestModelForTask("reasoning"),
      prompt: reasoningPrompt,
      systemPrompt: "أنت ذكاء حقيقي. لا تتبع قواعد جامدة. استنتج. فكر. قرر.",
      temperature: 0.4,
      maxTokens: 1500,
    });

    if (!response.success || !response.content) {
      return createFallbackReasoning(context);
    }

    const parsed = parseReasoningResponse(response.content);
    
    // Store the reasoning for future context
    await storeMemory({
      type: "decision",
      category: "reasoning",
      content: `فهمت "${context.userMessage}" بأنه: ${parsed.understanding}`,
      priority: "normal",
      context: { userId: context.userId, confidence: parsed.confidence },
    }).catch(() => {});

    return parsed;
  } catch (error) {
    console.error("Reasoning failed:", error);
    return createFallbackReasoning(context);
  }
}

/**
 * Execute based on reasoning, not hardcoded rules
 */
export async function executeBasedOnReasoning(
  reasoning: ReasoningResult,
  context: ReasoningContext
): Promise<{ success: boolean; message: string; data?: unknown }> {
  
  // If needs clarification, just return the reasoning response
  if (reasoning.needsClarification || !reasoning.canExecute) {
    return {
      success: true,
      message: reasoning.response,
      data: { reasoning, awaitingInput: true },
    };
  }

  // If we have a tool selected with all params, execute it
  if (reasoning.selectedTool && reasoning.toolParams) {
    try {
      const result = await executeTool(
        reasoning.selectedTool as import("@/lib/real-tool-executor").ToolName,
        reasoning.toolParams,
        {
          executionId: crypto.randomUUID(),
          actorUserId: context.userId,
        }
      );

      return {
        success: result.success,
        message: result.message,
        data: result.data,
      };
    } catch (error) {
      return {
        success: false,
        message: `فشل التنفيذ: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
      };
    }
  }

  // No tool needed, just respond
  return {
    success: true,
    message: reasoning.response,
    data: { reasoning },
  };
}

/**
 * Learn from interaction
 */
export async function learnFromInteraction(
  userMessage: string,
  reasoning: ReasoningResult,
  outcome: { success: boolean; userSatisfied?: boolean },
  userId: string
): Promise<void> {
  
  // If user wasn't satisfied, store what went wrong
  if (outcome.userSatisfied === false) {
    await storeMemory({
      type: "learning",
      category: "misunderstanding",
      content: `فهمت "${userMessage}" بأنه "${reasoning.understanding}" لكن كان خطأ`,
      priority: "high",
      context: { userId, correctUnderstanding: "unknown" },
    }).catch(() => {});
  }

  // Store successful patterns
  if (outcome.success && reasoning.confidence > 0.8) {
    await storeMemory({
      type: "learning",
      category: "successful_pattern",
      content: `"${userMessage}" ←→ "${reasoning.intent}"`,
      priority: "normal",
      context: { userId, confidence: reasoning.confidence },
    }).catch(() => {});
  }
}

// Helper functions

function parseReasoningResponse(content: string): ReasoningResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return createFallbackReasoning({ userMessage: content, conversationHistory: [], userId: "", availableTools: [] });
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      understanding: parsed.understanding || "",
      intent: parsed.intent || "unknown",
      requiredInfo: parsed.requiredInfo || [],
      missingInfo: parsed.missingInfo || [],
      selectedTool: parsed.selectedTool,
      toolParams: parsed.toolParams || {},
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || "",
      response: parsed.response || "ممكن توضح أكتر؟",
      needsClarification: parsed.needsClarification || false,
      canExecute: parsed.canExecute || false,
    };
  } catch {
    return createFallbackReasoning({ userMessage: content, conversationHistory: [], userId: "", availableTools: [] });
  }
}

function createFallbackReasoning(context: ReasoningContext): ReasoningResult {
  return {
    understanding: "غير واضح",
    intent: "unknown",
    requiredInfo: [],
    missingInfo: ["النوايا غير واضحة"],
    confidence: 0.3,
    reasoning: "فشل في التحليل",
    response: "ممكن توضح أكتر عايز تعمل إيه؟",
    needsClarification: true,
    canExecute: false,
  };
}
