import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askGroq, askGroqMessages } from "@/lib/ai-orchestrator";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Admin configuration
const MASTER_ADMIN_EMAILS = (process.env.MASTER_ADMIN_EMAILS || "")
  .split(",")
  .map(e => e.trim())
  .filter(Boolean);

// Admin session IDs (can be expanded as needed)
const ADMIN_SESSION_IDS: string[] = [];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const SYSTEM_PROMPT = `أنت "مستشار أزينث الذكي"، مدير مبيعات محترف وملتزم في شركة "أزينث ليفينج".
هدف الأساسي: تحويل الزائر إلى عميل حقيقي عبر بناء الثقة والاحترافية.

القواعد الصارمة (ممنوع تجاوزها تحت أي ظرف):
1. سياسة الأسعار:
- ممنوع منعاً باتاً اختراع أي أسعار أو تكاليف محددة (مثل: "الخزانة بـ 20 ألف").
- إذا سأل العميل عن السعر، قل: "التكلفة تختلف بناءً على المقاسات ونوع الخشب والتصميم المختار. يمكنني إعطاؤك نطاقاً تقريبياً بعد أن يراجع المهندس التفاصيل، أو يمكننا حجز موعد معاينة مجانية لتحديد التكلفة بدقة."
- لا تذكر أسعاراً محددة إلا إذا كانت موجودة في "التعليمات الموثقة" من المدير (Learnings).

2. المعلومات الشخصية والعناوين:
- ممنوع اختراع أسماء لأصحاب الشركة أو عناوين أو أرقام تليفونات.
- إذا لم تكن المعلومة في "التعليمات الموثقة"، قل: "سأقوم بالتأكد من هذه المعلومة من الإدارة والرد عليك فوراً، هل تسمح لي برقم هاتفك ليتواصل معك المسؤول؟"

3. التعامل مع الأسئلة المجهولة:
- إذا سألك العميل سؤالاً لا تملك له إجابة موثقة (مثل: "أين معرضكم؟" أو "من هو المدير؟"):
   أ) لا تؤلف إجابة أبداً.
   ب) قل: "هذا استفسار هام، سأقوم بنقله لمدير المبيعات الآن وسيقوم بالرد عليك."
   ج) سيقوم النظام تلقائياً بتنبيه المدير في لوحة التحكم بسؤالك.

4. الهدف البيعي:
- ركز على سحب بيانات العميل (الاسم، الهاتف، نوع الغرفة، الميزانية المتوقعة).
- شجع العميل على "حجز موعد استشارة" بدلاً من إعطائه تفاصيل فنية أو مادية قد تكون خاطئة.

هويتك: أنت موظف ملتزم بقواعد الشركة، لست مخترعاً ولا مؤلفاً. الأمانة والدقة أهم من سرعة الإجابة.`;

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
  userEmail?: string;
}

interface ConsultantLearning {
  id: string;
  instruction: string;
  created_at: string;
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
 * Check if user is admin based on sessionId or email
 */
function isAdmin(sessionId?: string, userEmail?: string): boolean {
  // Check by email
  if (userEmail && MASTER_ADMIN_EMAILS.includes(userEmail)) {
    return true;
  }
  // Check by session ID
  if (sessionId && ADMIN_SESSION_IDS.includes(sessionId)) {
    return true;
  }
  return false;
}

/**
 * Save learning instruction to database
 */
async function saveLearning(instruction: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error("[Consultant] Supabase admin client not available");
      return false;
    }

    const { error } = await supabaseAdmin
      .from("consultant_learnings")
      .insert({
        instruction: instruction.trim(),
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[Consultant] Error saving learning:", error);
      return false;
    }

    console.log("[Consultant] Learning saved:", instruction.substring(0, 50) + "...");
    return true;
  } catch (err) {
    console.error("[Consultant] Exception saving learning:", err);
    return false;
  }
}

/**
 * Get all learnings from database
 */
async function getLearnings(): Promise<string[]> {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error("[Consultant] Supabase admin client not available");
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from("consultant_learnings")
      .select("instruction")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Consultant] Error fetching learnings:", error);
      return [];
    }

    return (data || []).map((row: { instruction: string }) => row.instruction);
  } catch (err) {
    console.error("[Consultant] Exception fetching learnings:", err);
    return [];
  }
}

/**
 * Send WhatsApp notification to admin about unknown question
 */
async function notifyAdminUnknownQuestion(question: string, sessionId: string): Promise<void> {
  try {
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || "01090819584";
    
    const message = `🔔 *سؤال جديد للمستشار*

السؤال: ${question}

معرف الجلسة: ${sessionId}

الرجاء الرد على هذا السؤال في وضع التعلم لتدريب المستشار.`;

    console.log(`[Consultant] Would send WhatsApp to ${adminPhone}:`, message);
    
    // Log the notification
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      await supabaseAdmin.from("events").insert({
        id: crypto.randomUUID(),
        type: "consultant_unknown_question",
        value: question.substring(0, 100),
        metadata: {
          session_id: sessionId,
          admin_phone: adminPhone,
          notified_at: new Date().toISOString(),
        },
      });
    }

    // REAL WHATSAPP SENDING via internal API
    const internalApiKey = process.env.INTERNAL_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    try {
      await fetch(`${baseUrl}/api/admin/agent/communication`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalApiKey}`
        },
        body: JSON.stringify({
          type: 'whatsapp_notification',
          recipient: adminPhone,
          message
        })
      });
      console.log(`[Consultant] Real WhatsApp notification triggered for admin`);
    } catch (whErr) {
      console.error("[Consultant] Failed to trigger real WhatsApp notify:", whErr);
    }
  } catch (err) {
    console.error("[Consultant] Error notifying admin:", err);
  }
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
    const { message, sessionId: providedSessionId, history = [], userName, userEmail } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    // Generate or use existing session ID
    const sessionId = providedSessionId || generateSessionId();

    // Check if in Admin Learning Mode
    const adminMode = isAdmin(sessionId, userEmail);

    // ADMIN LEARNING MODE
    if (adminMode) {
      console.log(`[Consultant] Admin learning mode - Session ${sessionId}`);
      
      // Save the instruction/learning
      const saved = await saveLearning(message);
      
      const reply = saved 
        ? "تم حفظ المعلومة. شكراً لك."
        : "حدث خطأ أثناء حفظ المعلومة. الرجاء المحاولة مرة أخرى.";

      return NextResponse.json({
        reply,
        sessionId,
      });
    }

    // NORMAL VISITOR MODE
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

    // Fetch all learnings and build enhanced system prompt
    const learnings = await getLearnings();
    
    // Build messages array for Groq with system prompt and conversation history
    const groqMessages = buildGroqMessages(conversationHistory, userName, learnings);

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

    let reply = aiResult.content.trim();

    // Check if AI indicated it doesn't know the answer or is escalating
    const unknownIndicators = [
      "هذه المعلومة غير متاحة",
      "لا أعرف",
      "غير متأكد",
      "لا أملك هذه المعلومة",
      "غير موجودة في قاعدة البيانات",
      "سأقوم بالتأكد من هذه المعلومة",
      "سأقوم بنقله لمدير المبيعات",
      "أريد أن أعطيك إجابة دقيقة",
      "دعني أتأكد",
      "يتواصل معك المسؤول"
    ];
    
    const isUnknown = unknownIndicators.some(indicator => reply.includes(indicator));
    
    if (isUnknown) {
      // Notify admin about the unknown question (WhatsApp + Dashboard)
      await notifyAdminUnknownQuestion(message, sessionId);
      
      // Append message about admin notification if not already mentioned by AI
      if (!reply.includes("قريباً") && !reply.includes("تواصل")) {
        reply += "\n\n*ملاحظة: تم إرسال استفسارك لمدير المبيعات وسيتم الرد عليك في أقرب وقت.*";
      }
    }

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
 * Build Groq messages array with system prompt, learnings, and conversation history
 */
function buildGroqMessages(
  history: Message[],
  userName?: string,
  learnings: string[] = []
): GroqMessage[] {
  // Start with system message
  let systemContent = SYSTEM_PROMPT;
  
  // Add user name if provided
  if (userName) {
    systemContent += `\n\nاسم الزائر: ${userName}`;
  }
  
  // Add learnings to system prompt if available
  if (learnings.length > 0) {
    systemContent += `\n\n---\n\n[توجيهات إضافية من الإدارة - استخدمها عند الرد على الأسئلة]:\n\n`;
    learnings.forEach((learning, index) => {
      systemContent += `${index + 1}. ${learning}\n`;
    });
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
