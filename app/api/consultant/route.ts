import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askGroq, askGroqMessages } from "@/lib/ai-orchestrator";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const SYSTEM_PROMPT = `[معلومات مؤكدة عن أزينث ليفينج - لا تحيد عنها أبدًا]

اسم الشركة: أزينث ليفينج (Azenith Living).

النشاط: تصميم داخلي فاخر وأثاث راقي.

المقر: مدينة السلام , القاهرة، مصر.

لا يوجد معرض حاليًا. احنا بنصنع الاثاث حسب الطلب , جميع الاستشارات والتصاميم تتم عبر موقع الإنترنت أو الهاتف او الواتس او طلب معاينة.

مؤسس الشركة: المهندس علاء عزيز _alaa aziz

للتواصل: واتساب على رقم 01090819584 أو إيميل azenithliving@gmail.com.

إذا سألك العميل عن أي معلومة غير موجودة في هذه القائمة، أجب: "هذه المعلومة غير متاحة حاليًا. يمكنك التواصل مع فريقنا عبر واتساب لمزيد من التفاصيل."

---

أنت "مُستشار أزينث"، **مدير مبيعات أول** في "أزينث ليفينج"، أفخم دار تصميم داخلي. أنت مش مجرد موظف، أنت **شريك العميل في بناء حلمه**. خبرتك أكثر من 20 سنة في مجال مبيعات الاثاث المنزلى المصنع حسب الطلب.

**شخصيتك:**
- **واثق وهادئ:** كلامك متزن، واثق من جودة شغلك، مش محتاج تبالغ.
- **مستمع من الدرجة الأولى:** بتسمع أكتر مما بتتكلم. كل سؤال ليك هدف.
- **صريح ومباشر:** بتقول المعلومة المفيدة من غير لف ودوران.
- **دماغك شغالة:** بتحلل كل كلمة العميل يقولها عشان تفهم احتياجه الحقيقي.
- **لغة حوار:** عربي فصيح سلس، راقي لكن مش متكلف.

**مهمتك الأساسية:**
مش مجرد ترد على أسئلة. مهمتك إنك **تساعد العميل يكتشف إيه اللي هو محتاجه بجد**، وتوجهه ناحية الحل الأمثل.

**كيف تحقق ده؟**
1. **البداية:** ترحيب واحد بس في أول رسالة، وبعدين تسأل سؤال مفتوح وذكي.
2. **الأسئلة الذكية:** إسأل أسئلة تخليك تفهم نمط حياته.
3. **الاستنتاج والتوجيه:** بعد 3-4 تبادلات، لخص اللي فهمته.
4. **الاقتراح القاتل:** قدمله اقتراح واحد محدد وقوي بناءً على فهمك.
5. **التقفيل:** لو أبدى إعجابه، قدم له معاينة.

**تذكر دائمًا:**
- **السياق هو كل حاجة.** راجع تاريخ المحادثة كويس قبل أي رد.
- **متكررش التحية أبدًا.**
- **لو العميل سأل عن حاجة مش موجودة، قوله بصراحة.**
- **خلي ردودك قصيرة ومفيدة.**`;

// Types
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ConsultantRequest {
  message: string;
  sessionId?: string;
  history?: Message[];
  userName?: string;
}

interface ConsultantResponse {
  reply: string;
  sessionId: string;
}

interface Insights {
  roomType?: string;
  style?: string;
  budget?: string;
  urgency?: string;
  familySize?: string;
  lifestyle?: string;
  concerns?: string;
  lastTopic?: string;
  summary?: string;
  [key: string]: string | undefined;
}

interface ConsultantSession {
  id: string;
  session_id: string;
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
  insights?: Insights;
  created_at: string;
  updated_at: string;
}

/**
 * POST /api/consultant
 * Main consultant endpoint for Azenith AI Advisor
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ConsultantResponse | { error: string }>> {
  try {
    const body: ConsultantRequest = await request.json();
    const { message, sessionId: providedSessionId, history = [], userName } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    // Generate or use existing session ID
    const sessionId = providedSessionId || generateSessionId();

    // Fetch existing session from database
    const existingSession = await getSession(sessionId);
    
    // Build conversation history
    const conversationHistory: Message[] = existingSession?.messages || history || [];

    // Add user message to history
    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversationHistory.push(userMessage);

    // Build messages array for Groq with system prompt and conversation history
    const groqMessages = buildGroqMessages(conversationHistory, userName);

    // Get AI response using Groq with full conversation context
    const aiResult = await askGroqMessages(groqMessages, {
      maxTokens: 2048,
      temperature: 0.7,
    });

    if (!aiResult.success) {
      console.error("[Consultant] AI error:", aiResult.error);
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 500 }
      );
    }

    const reply = aiResult.content.trim();

    // Add AI response to history
    const assistantMessage: Message = {
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    };
    conversationHistory.push(assistantMessage);

    // Extract insights after 3-5 exchanges
    let insights: Insights | undefined = existingSession?.insights;
    if (conversationHistory.length >= 6 && conversationHistory.length <= 10) {
      insights = await extractInsights(conversationHistory, userName);
    }

    // Save session to database
    await saveSession(sessionId, conversationHistory, insights);

    console.log(`[Consultant] Session ${sessionId}: ${conversationHistory.length} messages`);

    return NextResponse.json({
      reply,
      sessionId,
    });

  } catch (error: any) {
    console.error("[Consultant] Detailed error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error?.message || "Unknown error",
        stack: error?.stack || "No stack trace"
      },
      { status: 500 }
    );
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `cons_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Build Groq messages array with system prompt and conversation history
 */
function buildGroqMessages(
  history: Message[],
  userName?: string
): GroqMessage[] {
  // Start with system message
  let systemContent = SYSTEM_PROMPT;
  if (userName) {
    systemContent += `\n\nاسم الزائر: ${userName}`;
  }

  const messages: GroqMessage[] = [
    { role: "system", content: systemContent }
  ];

  // Add conversation history (last 10 messages to avoid token limit)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content
    });
  }

  return messages;
}

/**
 * Get session from database
 */
async function getSession(sessionId: string): Promise<ConsultantSession | null> {
  try {
    const { data, error } = await supabase
      .from("consultant_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ConsultantSession;
  } catch (err) {
    console.error("[Consultant] Error fetching session:", err);
    return null;
  }
}

/**
 * Ensure all messages have timestamps
 */
function normalizeMessages(messages: Array<{ role: "user" | "assistant"; content: string; timestamp?: string }>): Message[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp || new Date().toISOString(),
  }));
}

/**
 * Extract insights from conversation using AI
 */
async function extractInsights(
  messages: Message[],
  userName?: string
): Promise<Insights | undefined> {
  try {
    // Build conversation text
    const conversationText = messages
      .map(m => `${m.role === "user" ? "الزائر" : "المستشار"}: ${m.content}`)
      .join("\n");

    const insightPrompt = `بناءً على هذه المحادثة بين مستشار التصميم الداخلي وزائر، استخرج الاستنتاجات التالية في شكل JSON:

المحادثة:
${conversationText}

استخرج هذه الحقول (إذا كانت متوفرة):
- roomType: نوع الغرفة/المساحة المطلوبة
- style: الاستايل المفضل
- budget: نطاق الميزانية
- urgency: مستوى الإلحاح
- familySize: حجم الأسرة
- lifestyle: نمط الحياة
- concerns: المخاوف أو التحفظات
- lastTopic: آخر موضوع تم مناقشته
- summary: ملخص موجز لاحتياجات الزائر

أرجع JSON فقط بدون أي شرح.`;

    const result = await askGroq(insightPrompt, {
      maxTokens: 1024,
      temperature: 0.5,
      jsonMode: true,
    });

    if (result.success) {
      // Try to parse JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const insights = JSON.parse(jsonMatch[0]) as Insights;
        console.log("[Consultant] Insights extracted:", insights);
        return insights;
      }
    }
  } catch (error) {
    console.error("[Consultant] Error extracting insights:", error);
  }
  return undefined;
}

/**
 * Save session to database
 */
async function saveSession(
  sessionId: string,
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp?: string }>,
  insights?: Insights
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Normalize messages to ensure timestamps exist
    const normalizedMessages = normalizeMessages(messages);

    // Check if session exists
    const existing = await getSession(sessionId);

    const sessionData: Record<string, unknown> = {
      messages: normalizedMessages,
      updated_at: now,
    };

    // Add insights if provided
    if (insights) {
      sessionData.insights = insights;
    }

    if (existing) {
      // Update existing session
      await supabase
        .from("consultant_sessions")
        .update(sessionData)
        .eq("session_id", sessionId);
    } else {
      // Insert new session
      await supabase.from("consultant_sessions").insert({
        session_id: sessionId,
        messages: normalizedMessages,
        insights: insights || null,
        created_at: now,
        updated_at: now,
      });
    }

    console.log(`[Consultant] Session saved: ${sessionId}${insights ? " with insights" : ""}`);
  } catch (err) {
    console.error("[Consultant] Error saving session:", err);
  }
}

/**
 * GET /api/consultant?sessionId=xxx
 * Retrieve session history
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId: session.session_id,
      messages: session.messages,
      insights: session.insights,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });

  } catch (error) {
    console.error("[Consultant] GET error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { error: errorMessage, stack: errorStack },
      { status: 500 }
    );
  }
}
