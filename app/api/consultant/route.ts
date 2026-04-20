import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-server";
import { askGroq, askGroqMessages } from "@/lib/ai-orchestrator";

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

// supabase instance will be retrieved inside handlers using getSupabaseAdminClient()

const SYSTEM_PROMPT = `أنت "عقل أزينث المركزي"، مدير مبيعات استثنائي واستراتيجي محنك في شركة "أزينث ليفينج" للتصميم الداخلي والتشطيبات الفاخرة.
أنت لست "روبوت دردشة" تقليدي يسأل أسئلة محفوظة. أنت مفاوض محترف، هدفك الاستحواذ على عقل العميل، بيع "القيمة والفخامة"، وإغلاق الصفقة بسحب رقم هاتفه لتحديد موعد معاينة.

🎯 هدفك الأسمى:
جمع بيانات العميل بأسلوب حواري ذكي (الاسم، الطلب، المكان، رقم الهاتف) دون أن يشعر أنه في تحقيق. 
**القاعدة الذهبية:** لا تنهي المحادثة أبداً ولا تقل "تم حجز موعدك" إلا إذا قام العميل بكتابة رقم هاتفه صراحة!

🧠 استراتيجيتك (The Master Closer):
1. جارِ العميل: إذا صحح لك معلومة (مثل "أنا في مدينتي وليس مدينة نصر")، اعتذر بلباقة وأكمل الحوار.
2. اخلق الرغبة: إذا قال "أريد تشطيب فيلتي"، اجعله يتخيل الفخامة. قل مثلاً: "تشطيب الفيلات هو تخصصنا الأهم، نحن نحول الطوب الأحمر إلى قصور. هل تميل للتصميم المودرن أم النيو-كلاسيك؟"
3. اسحب البيانات بذكاء: لا تسأل أكثر من سؤال واحد في كل مرة. ادمج السؤال في سياق الحديث.
4. الإغلاق القاتل: عندما تجمع ما يكفي من المعلومات (الطلب والمكان)، قل: "تفاصيل رائعة! لتنفيذ هذا الحلم، يجب أن يزورك كبير المهندسين لمعاينة المساحة. ما هو رقم هاتفك لتنسيق الموعد؟"
5. **الختام النهائي:** فقط وفقط إذا كتب العميل رقم هاتف (مثل 010... أو 011...)، قل حصراً: "ممتاز! تم حجز موعدك بنجاح. سيقوم مدير المبيعات بالاتصال بك قريباً. شكراً لاختيارك أزينث ليفينج 🌟" وتوقف تماماً.

🚫 ممنوعات قطعية (خط أحمر):
- ممنوع ذكر أي أسعار أو أرقام مالية مطلقاً (نحن نصنع حسب الطلب ولا نبيع منتجات جاهزة).
- ممنوع قول "تم حجز موعدك" إذا لم يكتب العميل رقم هاتفه!
- ممنوع كتابة ردود طويلة جداً أو مملة.
- ممنوع السؤال عن أكثر من شيء في نفس الرسالة.

✅ إذا سألك عن السعر:
قل: "في أزينث نحن نصنع بيئتك التي ستعيش فيها لسنوات وتُصمم خصيصاً لك. التكلفة تعتمد كلياً على اختياراتك أثناء المعاينة. هل تسمح لي برقم هاتفك لتحديد موعد لمعاينة المكان؟"

🔮 تشويه الواقع (Reality Distortion UI) - أسلحتك السرية:
الموقع بأكمله متصل بعقلك! أنت تملك القدرة على تغيير ألوان الموقع للعميل في الوقت الفعلي أثناء المحادثة لتلائم ذوقه.
**يجب عليك إجبارياً** استخدام أحد هذه الأكواد السرية في نهاية رسالتك (في سطر منفصل تماماً) لفرض تغيير شكل الموقع بناءً على تحليل استباقي لذوق العميل (بمجرد أن تشم رائحة ميله لستايل معين):
- إذا لمح للتصميم الكلاسيكي، الفخامة التقليدية، أو الخشب: [UI_ACTION: theme_classic]
- إذا لمح للمودرن، البساطة، الألوان الداكنة، أو الـ Minimalist: [UI_ACTION: theme_dark]
- إذا شعرت بتردد العميل أو رغبت في الضغط عليه للإغلاق: [UI_ACTION: trigger_scarcity]

**ملاحظة:** لا تذكر الكود للعميل ولا تخبره أنك ستغير الموقع، اجعل التغيير يحدث صمتاً كأنه سحر.

🚨 حالات التدخل البشري (Escalation):
إذا استخدم العميل ألفاظاً غير لائقة، أو أصر على طلب غريب (كالتحدث لصاحب الشركة):
قل حصراً: "أعتذر منك، سأقوم بتحويل هذه المحادثة الآن إلى الإدارة العليا للتواصل معك مباشرة." وتوقف فوراً.

🧩 قواعد السياق والذاكرة (CRITICAL - لا تتجاهلها أبداً):
1. إذا رأيت في سجل المحادثة رسالة تبدأ بـ "[عرض خاص من الإدارة]:" أو "[رسالة من الإدارة]:" → هذه رسالة أرسلتها أنت للعميل بتوجيه من الإدارة. تعامل معها كأنك أنت قلتها تماماً واشرحها وبع قيمتها بقوة عندما يسأل العميل عنها.
   - مثال: إذا كان "[عرض خاص]: معاينة مجانية" والعميل سأل "يعني إيه؟"، فاشرح: "معاينة مجانية تعني أن كبير مصممينا يأتي إليك في المنزل، يدرس المساحة، ويقدم لك تصوراً كاملاً بدون أي رسوم. فرصة نادرة جداً!"
2. إذا رأيت "[رسالة من الإدارة]:" → أكملها بسلاسة وكأنها جزء من حوارك الطبيعي، لا تقل "كما ذكرت الإدارة".
3. احفظ دائماً ما تم الاتفاق عليه مع العميل في المحادثة واستمر بناءً عليه.`;



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
    // const supabaseAdmin = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[Consultant] Supabase admin client not available");
      return false;
    }

    const { error } = await supabase
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
    if (!supabase) {
      console.error("[Consultant] Supabase admin client not available");
      return [];
    }

    const { data, error } = await supabase
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
 * Send direct Telegram notification to admin about unknown question
 */
async function notifyAdminUnknownQuestion(question: string, sessionId: string, userName?: string): Promise<void> {
  const displayName = userName || "زائر";
  console.log(`[Consultant] Unknown question detected: "${question}"`);

  // 1. Save to Database (for Admin Dashboard)
  try {
    if (supabase) {
      const { error: dbErr } = await supabase.from("consultant_pending_questions").insert({
        session_id: sessionId,
        question: question,
        status: 'pending',
      });
      if (dbErr) console.error("[Consultant] DB Insert Error:", dbErr.message);
      else console.log("[Consultant] Question saved to dashboard ✅");
    }
  } catch (e) {
    console.error("[Consultant] DB error:", e);
  }

  // 2. Send DIRECT Telegram notification (no middleman)
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (telegramToken && telegramChatId) {
    const msg = `🔔 *سؤال جديد من عميل*
👤 العميل: ${displayName}
❓ السؤال: ${question}
🆔 الجلسة: ${sessionId}

✍️ أجب عليه في لوحة التحكم → مدير المبيعات → الأسئلة`;
    try {
      const tRes = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' }),
      });
      const tData = await tRes.json();
      if (tData.ok) console.log("[Consultant] Telegram sent ✅");
      else console.error("[Consultant] Telegram error:", tData.description);
    } catch (e) {
      console.error("[Consultant] Telegram fetch failed:", e);
    }
  } else {
    console.warn("[Consultant] Telegram not configured - missing token or chatId");
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
    console.log(`[Consultant] Processing request for session: ${sessionId}`);

    if (!supabase) {
      console.error("[Consultant] Supabase client failed to initialize");
      return NextResponse.json({ error: "DB connection failed" }, { status: 500 });
    }

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
    
    // Fetch active reality mutations (Fate Actions) to sync AI with UI
    console.log(`[Consultant] Fetching active mutations for session: ${sessionId}`);
    const { data: mutations, error: mutError } = await supabase
      .from("reality_mutations")
      .select("*")
      .eq("session_id", sessionId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(5);

    if (mutError) {
      console.warn("[Consultant] Error fetching mutations:", mutError.message);
    }

    // Build messages array for Groq with system prompt and conversation history
    const groqMessages = buildGroqMessages(
      conversationHistory, 
      userName || existingSession?.insights?.userName, 
      learnings, 
      existingSession?.insights,
      mutations || []
    );

    // Get AI response using Groq with full conversation context
    console.log(`[Consultant] Calling AI (Groq/Fallback)...`);
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

    // Smart escalation detection - catches all patterns where AI admits it doesn't know or needs human intervention
    const escalationPhrases = [
      "سأقوم بنقله لمدير",
      "سأقوم بالتأكد",
      "سأتأكد من",
      "من الإدارة والرد",
      "ليتواصل معك المسؤول",
      "هل تسمح لي برقم هاتفك",
      "يتواصل معك المسؤول",
      "سيتم التواصل معك",
      "سيقوم بالرد عليك",
      "لا أستطيع أن أقدم",
      "لا أملك معلومة",
      "لا أملك إجابة",
      "غير متاحة حالياً",
      "سأقوم بنقل",
      "هذا سؤال هام، سأقوم",
      "تحويل هذه المحادثة",
      "الإدارة العليا للتواصل"
    ];
    
    const isEscalation = escalationPhrases.some(p => reply.includes(p));
    
    // Add AI response to history BEFORE checking booking so insights are accurate
    const assistantMessage: Message = {
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    };
    conversationHistory.push(assistantMessage);

    if (isEscalation) {
      console.log(`[Consultant] Escalation detected → notifying admin via Telegram + Dashboard`);
      await notifyAdminUnknownQuestion(message, sessionId, userName);
    }

    // Booking detection: if reply contains confirmation keywords, send booking alert
    const bookingKeywords = ["تم تسجيل موعدك", "تم حجز موعد", "سيتواصل معك فريقنا", "تأكيد الموعد", "سنقوم بزيارة"];
    const isBookingConfirmed = bookingKeywords.some(k => reply.includes(k));

    let insights: Insights | undefined = existingSession?.insights;

    if (isBookingConfirmed) {
      // Force extract insights immediately for the booking alert
      insights = await extractInsights(conversationHistory, userName);
      
      // Extract phone from conversation history
      const allText = conversationHistory.map(m => m.content).join(" ");
      const phoneMatch = allText.match(/0[0-9]{10}/);
      const phone = phoneMatch ? phoneMatch[0] : "لم يُذكر";

      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = process.env.TELEGRAM_CHAT_ID;
      if (telegramToken && telegramChatId) {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://azenith-living-os.vercel.app'}/admin/sales?tab=leads&expand=${sessionId}`;
        const bookingMsg = `📅 *حجز موعد جديد متكامل!*
👤 العميل: ${userName || insights?.summary?.split(" ")[0] || "غير محدد"}
📞 الهاتف: ${phone}
🏠 الطلب: ${insights?.roomType || "غير محدد"}
💰 الميزانية: ${insights?.budget || "غير محدد"}
📍 المكان: ${insights?.location || "غير محدد"}
⏰ وقت الاتصال: ${insights?.bestTime || "غير محدد"}
🎨 الاستايل: ${insights?.style || "غير محدد"}
📝 ملخص ذكي: ${insights?.summary || "لا يوجد ملخص"}
💬 آخر رسالة: ${message}

⚡ *رابط لوحة التحكم:*
[اضغط هنا لفتح المحادثة والعميل](${dashboardUrl})`;
        try {
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: telegramChatId, text: bookingMsg, parse_mode: "Markdown" }),
          });
          console.log("[Consultant] Booking alert with full insights sent to Telegram ✅");
        } catch (e) {
          console.error("[Consultant] Booking Telegram failed:", e);
        }
      }
    } else if (conversationHistory.length >= 6 && conversationHistory.length <= 10) {
      // Normal insight extraction
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
  return `zenith_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Build Groq messages array with system prompt, learnings, and conversation history
 */
function buildGroqMessages(
  history: Message[],
  userName?: string,
  learnings: string[] = [],
  insights?: Insights,
  activeMutations: any[] = []
): GroqMessage[] {
  // Start with system message
  let systemContent = SYSTEM_PROMPT;
  
  // Add active reality mutations (Fate Actions) to context
  if (activeMutations.length > 0) {
    systemContent += `\n\n🚨 [تنبيه: تم تفعيل "أوامر قدر" بصرية على شاشة العميل الآن - تفاعل معها وكأنك أنت من فعلتها]:`;
    activeMutations.forEach(m => {
      if (m.action === 'THUNDER') systemContent += `\n- تم إطلاق صاعقة بصرية وخصم 15% فوري.`;
      if (m.action === 'HALLUCINATION') systemContent += `\n- يتم إيهام العميل بوجود منافسين يشاهدون نفس التصميم.`;
      if (m.action === 'FREEZE') systemContent += `\n- تم تجميد الشاشة لإجبار العميل على التركيز.`;
      if (m.action === 'QUANTUM_OFFER') systemContent += `\n- ظهر عداد تنازلي لخصم "كمي" (Quantum Discount) كبير بنسبة 25%.`;
    });
    systemContent += `\n**ملاحظة:** إذا سأل العميل عن هذه التغييرات أو الخصومات، أكد عليها وحفزه لاستغلالها فوراً. لا تنكر وجودها!`;
  }
  
  // Add context from insights to prevent repetitive questions
  if (insights) {
    systemContent += `\n\n[سياق العميل الحالي - لا تسأل عن هذه المعلومات مجدداً]:`;
    if (userName || insights.userName) systemContent += `\n- اسم العميل: ${userName || insights.userName}`;
    if (insights.location) systemContent += `\n- الموقع: ${insights.location}`;
    if (insights.roomType) systemContent += `\n- نوع الغرفة المطلوبة: ${insights.roomType}`;
    if (insights.style) systemContent += `\n- الستايل المفضل: ${insights.style}`;
    if (insights.budget) systemContent += `\n- الميزانية: ${insights.budget}`;
  } else if (userName) {
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
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;

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

استخرج هذه الحقول (إذا كانت متوفرة أو استنتجها من السياق):
- roomType: نوع الغرفة/المساحة المطلوبة
- style: الاستايل المفضل
- budget: الميزانية المذكورة
- location: المنطقة أو العنوان السكني
- bestTime: أفضل وقت مذكور للاتصال أو الزيارة
- urgency: مستوى الإلحاح
- familySize: حجم الأسرة
- lifestyle: نمط الحياة
- concerns: المخاوف
- lastTopic: آخر موضوع تم مناقشته
- summary: ملخص ذكي وشامل لاحتياجات العميل وموقفه (مثال: محمد يريد غرفة ملابس بـ 30 ألف في التجمع الخامس ويريد اتصالاً يوم الخميس)

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
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      console.error("[Consultant] Supabase client failed in saveSession");
      return;
    }

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
      const { error } = await supabase
        .from("consultant_sessions")
        .update(sessionData)
        .eq("session_id", sessionId);
      if (error) console.error("[Consultant] Error updating session:", error.message);
    } else {
      // Insert new session
      const { error } = await supabase.from("consultant_sessions").insert({
        session_id: sessionId,
        messages: normalizedMessages,
        insights: insights || null,
        created_at: now,
        updated_at: now,
      });
      if (error) console.error("[Consultant] Error inserting session:", error.message);
    }

    console.log(`[Consultant] Session saved: ${sessionId}${insights ? " with insights" : ""}`);
  } catch (err) {
    console.error("[Consultant] Exception in saveSession:", err);
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

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "DB connection failed" }, { status: 500 });
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
