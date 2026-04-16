/**
 * Smart Agent API - Phase 1: Natural Language Understanding
 * Uses DeepSeek to understand Egyptian dialect and execute real commands
 */

import { updateSiteSetting, createAutomationRule, getAnalyticsReport, getSystemHealth } from "@/lib/architect-tools";

// DeepSeek API configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEYS?.split(",")[0]?.trim();
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    
    if (!message || typeof message !== "string") {
      return Response.json({ reply: "أهلاً بك! كيف أقدر أساعدك؟" }, { status: 400 });
    }

    // System prompt for Egyptian dialect understanding
    const systemPrompt = `أنت مساعد ذكي ودود لموقع "أزينث للتصميم الداخلي" (Azenith Living). المستخدم يتحدث بالعامية المصرية.

مهمتك:
1. رد برد ودي ولطيف بالعامية المصرية
2. افهم إذا كان المستخدم يطلب:
   - تغيير لون/إعداد (updateSiteSetting)
   - إنشاء قاعدة أتمتة (createAutomationRule)
   - تقرير زوار/إحصائيات (getAnalytics)
   - فحص حالة النظام (getSystemHealth)
   - أو مجرد تحية/سؤال عام (null)

أمثلة على الأوامر:
- "اهلا" أو "مساء الخير" → action: null, reply: "أهلاً بك، نورت! إيه اللي أقدر أساعدك فيه؟"
- "غير لون الأزرار للذهبي" → action: "updateSiteSetting", params: {key:"theme", value:{primaryColor:"#C5A059"}}, reply: "تمام! غيرت لون الأزرار للذهبي ✨"
- "كم عدد زوار اليوم؟" → action: "getAnalytics", params: {days:1}, reply: "جاري جلب التقرير..."
- "أنشئ قاعدة ترحيب" → action: "createAutomationRule", params: {name:"ترحيب", trigger:"page_visit", actions:[{type:"notification"}]}, reply: "تم إنشاء قاعدة الترحيب!"

الرسالة الحالية: "${message}"

أخرج JSON فقط بهذا الشكل:
{"reply": "الرد بالعامية المصرية", "action": "updateSiteSetting|createAutomationRule|getAnalytics|getSystemHealth|null", "params": {}}`;

    // Call DeepSeek API
    let parsedResponse: {
      reply: string;
      action: string | null;
      params?: Record<string, unknown>;
    };

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "أنت مساعد AI. أخرج JSON صالح فقط بدون أي شرح إضافي." },
            { role: "user", content: systemPrompt }
          ],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      parsedResponse = JSON.parse(content);
    } catch (llmError) {
      // Fallback: keyword-based parsing
      console.error("LLM error, using fallback:", llmError);
      parsedResponse = fallbackParse(message);
    }

    // Execute action if needed
    let executionResult = null;
    if (parsedResponse.action && parsedResponse.action !== "null") {
      try {
        switch (parsedResponse.action) {
          case "updateSiteSetting":
            executionResult = await updateSiteSetting(parsedResponse.params as any);
            break;
          case "createAutomationRule":
            executionResult = await createAutomationRule(parsedResponse.params as any);
            break;
          case "getAnalytics":
            executionResult = await getAnalyticsReport(parsedResponse.params as any);
            break;
          case "getSystemHealth":
            executionResult = await getSystemHealth();
            break;
        }

        // Append execution result to reply if successful
        if (executionResult?.success && executionResult?.message) {
          parsedResponse.reply += `\n\n${executionResult.message}`;
        } else if (executionResult?.error) {
          parsedResponse.reply += `\n\n⚠️ ${executionResult.error}`;
        }
      } catch (execError) {
        console.error("Action execution error:", execError);
        parsedResponse.reply += "\n\n⚠️ حصل خطأ أثناء التنفيذ، جرب تاني.";
      }
    }

    return Response.json({ 
      reply: parsedResponse.reply,
      action: parsedResponse.action,
      executed: executionResult?.success || false
    });

  } catch (error) {
    console.error("[SmartAgent] Error:", error);
    return Response.json({ 
      reply: "عذراً، حصل مشكلة في النظام. جرب تاني بعد شوية." 
    }, { status: 500 });
  }
}

// Fallback parsing when LLM is unavailable
function fallbackParse(message: string): { reply: string; action: string | null; params?: Record<string, unknown> } {
  const lower = message.toLowerCase();
  
  // Greetings
  if (/^(اهلا|مرحبا|أهلا|سلام|هاي|مساء|صباح|السلام)/i.test(lower)) {
    const greetings = [
      "أهلاً بك، نورت! 🌟",
      "أهلاً وسهلاً! كيف أقدر أساعدك؟ 👋",
      "مساء الفل! إيه الأخبار؟ 🌙",
      "هلا والله! شرفتنا 🎉"
    ];
    return {
      reply: greetings[Math.floor(Math.random() * greetings.length)],
      action: null
    };
  }
  
  // Color changes
  if (/(غير|غيّر|عدل|تغيير|خلّي).*(لون|ألوان|زر|أزرار)/i.test(lower)) {
    let color = "#C5A059"; // Default gold
    let colorName = "الذهبي";
    
    if (/(أحمر|red)/i.test(lower)) { color = "#EF4444"; colorName = "الأحمر"; }
    else if (/(أزرق|blue)/i.test(lower)) { color = "#3B82F6"; colorName = "الأزرق"; }
    else if (/(أخضر|green)/i.test(lower)) { color = "#10B981"; colorName = "الأخضر"; }
    else if (/(أسود|black)/i.test(lower)) { color = "#000000"; colorName = "الأسود"; }
    else if (/(أبيض|white)/i.test(lower)) { color = "#FFFFFF"; colorName = "الأبيض"; }
    
    return {
      reply: `تمام! هغير لون الأزرار للون ${colorName} 🎨`,
      action: "updateSiteSetting",
      params: { key: "theme", value: { primaryColor: color } }
    };
  }
  
  // Analytics/Visitors
  if (/(زوار|زيارات|visitors|عدد|إحصائ|مؤشر|reports|analytics)/i.test(lower)) {
    const days = /(يوم|today|النهار|1)/i.test(lower) ? 1 : 
                 /(أسبوع|week)/i.test(lower) ? 7 : 30;
    return {
      reply: "جاري جلب تقرير الزوار... 📊",
      action: "getAnalytics",
      params: { days }
    };
  }
  
  // Automation
  if (/(أتمتة|automation|قاعدة|rule|تلقائي)/i.test(lower)) {
    return {
      reply: "هنشئ قاعدة أتمتة جديدة ⚙️",
      action: "createAutomationRule",
      params: { 
        name: "قاعدة جديدة", 
        trigger: "page_visit",
        conditions: {},
        actions: [{ type: "notification", message: "أهلاً بك في موقعنا!" }]
      }
    };
  }
  
  // System health
  if (/(صحة|health|نظام|system|فحص|check|حالة الموقع)/i.test(lower)) {
    return {
      reply: "جاري فحص حالة النظام... 🔍",
      action: "getSystemHealth",
      params: {}
    };
  }
  
  // Unknown
  return {
    reply: "آسف، لم أفهم طلبك تماماً. 😅\n\nجرب تقول:\n• \"غير لون الأزرار للذهبي\"\n• \"كم عدد زوار اليوم؟\"\n• \"أنشئ قاعدة ترحيب\"\n• \"فحص النظام\"",
    action: null
  };
}
