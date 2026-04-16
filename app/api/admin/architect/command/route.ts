/**
 * Architect Command API - Phase 2
 * Processes natural language commands through function calling
 * Endpoint: POST /api/admin/architect/command
 */

import { NextRequest, NextResponse } from "next/server";
import { executeTool, TOOL_DEFINITIONS } from "@/lib/architect-tools";
import { askOpenRouter } from "@/lib/ai-orchestrator";

export const dynamic = "force-dynamic";

interface CommandRequest {
  command: string;
  conversationId?: string;
}

interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * POST /api/admin/architect/command
 * Processes a natural language command and executes the appropriate tool
 */
export async function POST(request: NextRequest) {
  try {
    const body: CommandRequest = await request.json();
    const { command, conversationId } = body;

    if (!command || typeof command !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid command",
          message: "❌ يجب توفير أمر صالح"
        },
        { status: 400 }
      );
    }

    console.log(`[Architect Command] Received: "${command}" (conversation: ${conversationId || "new"})`);

    // Step 1: Use AI to determine which tool to call and extract parameters
    const systemPrompt = `أنت المهندس المعماري الذكي لنظام Azenith Living. مهمتك تحويل أوامر المستخدم إلى استدعاءات دوال (function calling).

لديك 4 أدوات متاحة:
1. createAutomationRule - إنشاء قاعدة أتمتة جديدة
2. updateSiteSetting - تحديث إعدادات الموقع (ألوان، خطوط، SEO)
3. getAnalyticsReport - جلب تقرير تحليلات (زوار، تحويلات)
4. getSystemHealth - فحص صحة النظام

حلل طلب المستخدم بدقة:
- إذا طلب "أنشئ قاعدة أتمتة" → استدعِ createAutomationRule
- إذا طلب "غيّر اللون" أو "حدّث الإعدادات" → استدعِ updateSiteSetting
- إذا طلب "كم عدد الزوار" أو "أعطني تقرير" → استدعِ getAnalyticsReport
- إذا طلب "حالة النظام" أو "هل كل شيء بخير" → استدعِ getSystemHealth

يجب أن تعيد JSON صالح بهذا الشكل:
{
  "tool": "اسم_الأداة",
  "parameters": { ... },
  "explanation": "شرح مختصر لما سيتم تنفيذه"
}`;

    // Call OpenRouter for function calling analysis
    let functionCall: FunctionCall | null = null;
    let aiExplanation = "";

    try {
      const openRouterResult = await askOpenRouter(
        `${systemPrompt}\n\nطلب المستخدم: "${command}"\n\nأعد JSON فقط بدون أي شرح إضافي:`,
        undefined,
        {
          model: "anthropic/claude-3.5-sonnet",
          temperature: 0.3, // Lower temperature for more deterministic function calling
          maxTokens: 1024
        }
      );

      if (openRouterResult.success && openRouterResult.content) {
        // Try to parse the AI response as JSON
        const aiResponse = openRouterResult.content.trim();
        
        // Extract JSON from the response (in case there's markdown or extra text)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.tool && typeof parsed.tool === "string") {
              functionCall = {
                name: parsed.tool,
                arguments: parsed.parameters || {}
              };
              aiExplanation = parsed.explanation || "";
              console.log(`[Architect Command] AI selected tool: ${functionCall.name}`);
            }
          } catch (parseErr) {
            console.error("[Architect Command] Failed to parse AI JSON:", parseErr);
          }
        }
      }
    } catch (aiError) {
      console.error("[Architect Command] AI analysis failed:", aiError);
    }

    // Step 2: If AI didn't determine a tool, try pattern matching as fallback
    if (!functionCall) {
      functionCall = matchCommandToTool(command);
      if (functionCall) {
        console.log(`[Architect Command] Pattern matching selected tool: ${functionCall.name}`);
      }
    }

    // Step 3: Execute the tool if one was determined
    if (functionCall) {
      console.log(`[Architect Command] Executing: ${functionCall.name} with params:`, functionCall.arguments);
      
      const result = await executeTool(functionCall.name, functionCall.arguments);
      
      return NextResponse.json({
        success: result.success,
        message: result.message,
        data: result.data,
        tool: functionCall.name,
        error: result.error,
        fallback: !result.success ? "يمكنك استخدام التبويب اليدوي (الأتمتة، التحليلات، أو غرفة العمليات) لتنفيذ طلبك يدوياً" : undefined
      });
    }

    // Step 4: No tool matched - return helpful response
    return NextResponse.json({
      success: false,
      message: "🤔 لم أفهم طلبك تماماً. يمكنني مساعدتك في:",
      suggestions: [
        "• إنشاء قواعد أتمتة (مثال: 'أنشئ قاعدة ترسل واتساب عند قبول حجز')",
        "• تغيير إعدادات الموقع (مثال: 'غيّر لون الأزرار إلى الأزرق')",
        "• جلب تقارير التحليلات (مثال: 'كم عدد زوار اليوم؟')",
        "• فحص صحة النظام (مثال: 'هل النظام يعمل بشكل جيد؟')"
      ],
      fallback: "يمكنك استخدام التبويبات اليدوية في الأعلى لتنفيذ ما تريد"
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[Architect Command] Unexpected error:", errorMsg);
    
    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
        message: "❌ حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.",
        fallback: "يمكنك استخدام التبويبات اليدوية كحل بديل"
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback pattern matching for common commands
 * Used when AI analysis fails or isn't available
 */
function matchCommandToTool(command: string): FunctionCall | null {
  const lowerCmd = command.toLowerCase();
  
  // Pattern 1: Create automation rule
  if (lowerCmd.includes("قاعدة") || lowerCmd.includes("أتمتة") || lowerCmd.includes("automation")) {
    // Extract name if mentioned
    const nameMatch = command.match(/(?:باسم|اسم|سمها|name)\s*[:\s]\s*([^،,.]+)/i);
    const name = nameMatch ? nameMatch[1].trim() : "قاعدة أتمتة جديدة";
    
    // Extract trigger type
    let trigger = "page_visit";
    if (lowerCmd.includes("حجز") || lowerCmd.includes("booking")) trigger = "booking_status_changed";
    else if (lowerCmd.includes("نموذج") || lowerCmd.includes("form")) trigger = "form_submit";
    else if (lowerCmd.includes("تأخير") || lowerCmd.includes("delay")) trigger = "time_delay";
    else if (lowerCmd.includes("مستخدم") || lowerCmd.includes("user")) trigger = "user_registered";
    
    return {
      name: "createAutomationRule",
      arguments: {
        name,
        trigger,
        conditions: {},
        actions: [{ type: "notification", message: "تم تنشيط القاعدة" }],
        enabled: true
      }
    };
  }
  
  // Pattern 2: Site settings (colors, SEO)
  if (lowerCmd.includes("لون") || lowerCmd.includes("لون") || lowerCmd.includes("color") ||
      lowerCmd.includes("خط") || lowerCmd.includes("font") ||
      lowerCmd.includes("عنوان") || lowerCmd.includes("seo") ||
      lowerCmd.includes("إعداد") || lowerCmd.includes("setting")) {
    
    // Extract color if mentioned
    const colorMatch = command.match(/[#]?([A-Fa-f0-9]{6})/);
    if (colorMatch) {
      return {
        name: "updateSiteSetting",
        arguments: {
          key: "theme",
          value: { primaryColor: `#${colorMatch[1]}` }
        }
      };
    }
    
    // Default to theme update
    return {
      name: "updateSiteSetting",
      arguments: {
        key: "theme",
        value: { primaryColor: "#C5A059" }
      }
    };
  }
  
  // Pattern 3: Analytics report
  if (lowerCmd.includes("زوار") || lowerCmd.includes("زيارات") || lowerCmd.includes("visitors") ||
      lowerCmd.includes("تحليل") || lowerCmd.includes("analytics") || lowerCmd.includes("تقرير") ||
      lowerCmd.includes("إحصائيات") || lowerCmd.includes("كم عدد") || lowerCmd.includes("كمية")) {
    
    // Extract period
    let days = 30;
    if (lowerCmd.includes("7") || lowerCmd.includes("أسبوع")) days = 7;
    else if (lowerCmd.includes("90") || lowerCmd.includes("3 أشهر")) days = 90;
    else if (lowerCmd.includes("اليوم") || lowerCmd.includes("today")) days = 1;
    
    return {
      name: "getAnalyticsReport",
      arguments: { days }
    };
  }
  
  // Pattern 4: System health
  if (lowerCmd.includes("نظام") || lowerCmd.includes("system") ||
      lowerCmd.includes("صحة") || lowerCmd.includes("health") ||
      lowerCmd.includes("شغال") || lowerCmd.includes("يعمل") ||
      lowerCmd.includes("فحص") || lowerCmd.includes("check") ||
      lowerCmd.includes("مشكلة") || lowerCmd.includes("problem")) {
    
    return {
      name: "getSystemHealth",
      arguments: {}
    };
  }
  
  return null;
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Architect Command API is ready",
    tools: TOOL_DEFINITIONS.map(t => t.name),
    timestamp: new Date().toISOString()
  });
}
