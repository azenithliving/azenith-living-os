import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askAllam } from "@/lib/ai-orchestrator";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// System Prompt for Azenith Consultant
const SYSTEM_PROMPT = `أنت "مُستشار أزينث"، مندوب مبيعات خبير في التصميم الداخلي الفاخر. 
هدفك فهم احتياج الزائر الحقيقي من خلال أسئلة مفتوحة ذكية. 
لا تعرض خيارات متعددة إلا للضرورة. 
تحدث بلغة عربية فصحى راقية ومهذبة. 
خاطب الزائر باسمه إذا عرفته. 
بعد فهم احتياجه، قدم له اقتراحًا واحدًا مخصصًا.

أنت تمثل شركة أزينث للتصميم الداخلي الفاخر. خدماتنا تشمل:
- تصميم غرف المعيشة والنوم والمطابخ
- التصاميم المودرن والكلاسيكية والصناعية والاسكندنافية
- استشارات شخصية للتصميم الداخلي

اسأل عن:
- نوع الغرفة المطلوبة
- الاستايل المفضل
- الميزانية التقريبية
- أي متطلبات خاصة

كن لطيفًا، احترافيًا، ومهتمًا بفهم احتياجات العميل بعمق.`;

// Types
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
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

interface ConsultantSession {
  id: string;
  session_id: string;
  messages: Array<{ role: "user" | "assistant"; content: string; timestamp: string }>;
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

    // Prepare prompt with system instructions and history
    const fullPrompt = buildPrompt(conversationHistory, userName);

    // Get AI response using ALLaM (Gulf Arabic premium model)
    const aiResult = await askAllam(fullPrompt, {
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

    // Save session to database
    await saveSession(sessionId, conversationHistory);

    console.log(`[Consultant] Session ${sessionId}: ${conversationHistory.length} messages`);

    return NextResponse.json({
      reply,
      sessionId,
    });

  } catch (error) {
    console.error("[Consultant] Route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
 * Build the full prompt with system instructions and conversation history
 */
function buildPrompt(
  history: Message[],
  userName?: string
): string {
  let prompt = SYSTEM_PROMPT;

  if (userName) {
    prompt += `\n\nاسم الزائر: ${userName}`;
  }

  prompt += "\n\nسجل المحادثة:\n";

  // Add conversation history (last 10 messages to avoid token limit)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    const role = msg.role === "user" ? "الزائر" : "مستشار أزينث";
    prompt += `${role}: ${msg.content}\n`;
  }

  prompt += "\nمستشار أزينث:";

  return prompt;
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
 * Save session to database
 */
async function saveSession(
  sessionId: string,
  messages: Message[]
): Promise<void> {
  try {
    const now = new Date().toISOString();

    // Check if session exists
    const existing = await getSession(sessionId);

    if (existing) {
      // Update existing session
      await supabase
        .from("consultant_sessions")
        .update({
          messages,
          updated_at: now,
        })
        .eq("session_id", sessionId);
    } else {
      // Insert new session
      await supabase.from("consultant_sessions").insert({
        session_id: sessionId,
        messages,
        created_at: now,
        updated_at: now,
      });
    }

    console.log(`[Consultant] Session saved: ${sessionId}`);
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
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    });

  } catch (error) {
    console.error("[Consultant] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
