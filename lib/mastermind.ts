"use server";

import { createClient } from "@supabase/supabase-js";
import { 
  applyCode, 
  getCodebaseOverview, 
  generateImperialGreeting, 
  getSystemStatus as getArchitectSystemStatus 
} from "./supreme-architect";
import { loadUserPreferences, processExecutiveResponse } from "./executive-persona";
import { 
  startAutonomousMode as startSilentMode, 
  getStatus as getSilentStatus,
  toggleAutonomousMode 
} from "./silent-architect";
import { 
  getSystemStats, 
  triggerHealing, 
  translate 
} from "./sovereign-os";
import { 
  startMonitoring as startProactiveMonitoring 
} from "./proactive-autonomy";
import { askGroq, askOpenRouter, askMistral } from "./ai-orchestrator";

// ============================================
// INTERNAL TYPES
// ============================================

interface TripleAAction {
  id: string;
  phase: "analyze" | "preview" | "execute" | "completed" | "rolled_back";
  analysis: string;
  previewUrl?: string;
  changes: Array<{
    file: string;
    before: string;
    after: string;
  }>;
  rollbackAvailable: boolean;
}

interface SemanticCache {
  query: string;
  response: string;
  timestamp: Date;
  hitCount: number;
}

interface MobileNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "urgent";
}

type BrandSoulAlignment = "matte_black" | "subtle_gold_accents" | "natural_textures" | "soft_lighting" | "architectural_lines";

// ============================================
// INTERNAL CLASS - Not Exported (No export keyword)
// ============================================

class AzenithMastermind {
  private static instance: AzenithMastermind;
  private supabase: ReturnType<typeof createClient>;
  private semanticCache: Map<string, SemanticCache> = new Map();
  private actionHistory: Map<string, TripleAAction> = new Map();
  private isMonitoring: boolean = false;

  private brandSoul = {
    essence: "Azenith Living - Where Luxury Meets Comfort" as const,
    colors: ["#1a1a1a", "#2d2d2d", "#C5A059", "#8B7355", "#f5f5f5"],
    tone: "Luxurious, warm, powerful, understated elegance",
    forbidden: ["neon colors", "clipart", "comic sans", "stock photos", "loud patterns"],
    preferred: ["matte_black", "subtle_gold_accents", "natural_textures", "soft_lighting", "architectural_lines"] as BrandSoulAlignment[],
  };

  private constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase credentials for Mastermind");
    }

    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  static getInstance(): AzenithMastermind {
    if (!AzenithMastermind.instance) {
      AzenithMastermind.instance = new AzenithMastermind();
    }
    return AzenithMastermind.instance;
  }

  async getDatabaseState(): Promise<{
    totalTables: number;
    recordCounts: Record<string, number>;
    recentActivity: string[];
  }> {
    const tables = [
      "room_sections",
      "requests",
      "intelligence_snapshots",
      "semantic_cache",
      "api_keys_arsenal",
    ];

    const recordCounts: Record<string, number> = {};

    for (const table of tables) {
      const { count } = await this.supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      recordCounts[table] = count || 0;
    }

    const { data: recent } = await this.supabase
      .from("system_intelligence")
      .select("metric_type, observed_at")
      .order("observed_at", { ascending: false })
      .limit(5);

    return {
      totalTables: tables.length,
      recordCounts,
      recentActivity: recent?.map((r) => `${String(r.metric_type)} at ${String(r.observed_at)}`) || [],
    };
  }

  async getFilesystemState(): Promise<{
    totalFiles: number;
    recentChanges: string[];
    criticalFiles: string[];
  }> {
    const overview = await getCodebaseOverview();

    const { data: actions } = await this.supabase
      .from("architect_actions")
      .select("target_path, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      totalFiles: overview.length,
      recentChanges: actions?.map((a) => String(a.target_path)) || [],
      criticalFiles: [
        "app/page.tsx",
        "app/layout.tsx",
        "lib/sovereign-os.ts",
        "components/elite/AestheticAdvisor.tsx",
      ],
    };
  }

  async analyzeAndPropose(
    userMessage: string,
    sessionId: string,
    userId?: string
  ): Promise<TripleAAction> {
    const analysis = await this.performDeepAnalysis(userMessage, userId);

    const action: TripleAAction = {
      id: `aaa_${Date.now()}`,
      phase: "analyze",
      analysis,
      changes: [],
      rollbackAvailable: true,
    };

    this.actionHistory.set(action.id, action);

    const understanding = await this.understandIntent(userMessage, userId);

    if (understanding.confidence > 0.8) {
      action.phase = "preview";
      action.changes = await this.generateProposedChanges(userMessage, understanding);
      action.previewUrl = await this.createStagingPreview(action);
    }

    return action;
  }

  private async performDeepAnalysis(message: string, userId?: string): Promise<string> {
    const [intent, systemStatus] = await Promise.all([
      this.understandIntent(message, userId),
      getSystemStats(),
    ]);

    let analysis = `**تحليلي العميق:**\n\n`;
    analysis += `• **نية المستخدم:** ${intent.intent} (ثقة: ${(intent.confidence * 100).toFixed(0)}%)\n`;
    analysis += `• **روح البراند:** ${intent.brandSoul}\n`;
    analysis += `• **حالة النظام:** كفاءة ${systemStatus.cacheEfficiency.hitRate}%\n`;

    return analysis;
  }

  private async understandIntent(message: string, userId?: string): Promise<{
    intent: string;
    brandSoul: BrandSoulAlignment;
    shouldAct: boolean;
    confidence: number;
  }> {
    const lower = message.toLowerCase();
    let soulAlignment: BrandSoulAlignment = "matte_black";

    if (lower.match(/(صور|image|photo|صورة)/)) {
      if (lower.match(/(مش عاجب|bad|poor|weak|ممل)/)) {
        soulAlignment = "matte_black";
        return {
          intent: "improve_images_to_industrial",
          brandSoul: soulAlignment,
          shouldAct: true,
          confidence: 0.95,
        };
      }
    }

    if (lower.match(/(فخامة|luxury|فاخر|premium)/)) {
      soulAlignment = "subtle_gold_accents";
    }

    if (lower.match(/(طبيعي|natural|organic|warm)/)) {
      soulAlignment = "natural_textures";
    }

    if (userId) {
      const prefs = await loadUserPreferences(userId);
      if (prefs.knownPreferences.includes("prefers_matte_black")) {
        soulAlignment = "matte_black";
      }
    }

    return {
      intent: "general",
      brandSoul: soulAlignment,
      shouldAct: false,
      confidence: 0.7,
    };
  }

  private async generateProposedChanges(
    message: string,
    understanding: { intent: string; brandSoul: BrandSoulAlignment; shouldAct: boolean; confidence: number }
  ): Promise<TripleAAction["changes"]> {
    const changes: TripleAAction["changes"] = [];

    if (understanding.intent === "improve_images_to_industrial") {
      changes.push({
        file: "components/room/RoomGallery.tsx",
        before: "// Current: Standard room display",
        after: `// Proposed: Industrial matte black aesthetic
// - Desaturated tones
// - Strong shadows
// - Minimal warm accents`,
      });
    }

    return changes;
  }

  private async createStagingPreview(action: TripleAAction): Promise<string> {
    return `/admin/preview/${action.id}`;
  }

  async atomicRollback(actionId: string): Promise<{
    success: boolean;
    restored: boolean;
    message: string;
  }> {
    const action = this.actionHistory.get(actionId);
    if (!action || !action.rollbackAvailable) {
      return {
        success: false,
        restored: false,
        message: "لا يوجد إجراء للتراجع عنه",
      };
    }

    try {
      const { data: originals } = await this.supabase
        .from("system_snapshots")
        .select("*")
        .eq("action_id", actionId)
        .eq("snapshot_type", "pre_execution");

      interface SnapshotRow {
        file_path: string;
        original_content: string;
      }

      const typedOriginals = originals as unknown as SnapshotRow[];

      if (typedOriginals && typedOriginals.length > 0) {
        for (const snapshot of typedOriginals) {
          await applyCode(snapshot.file_path, snapshot.original_content);
        }

        return {
          success: true,
          restored: true,
          message: "✨ تمت العودة عبر الزمن بنجاح. كل شيء كما كان.",
        };
      }

      return {
        success: false,
        restored: false,
        message: "لم يتم العثور على نسخة احتياطية",
      };
    } catch (error) {
      return {
        success: false,
        restored: false,
        message: `فشل التراجع: ${error}`,
      };
    }
  }

  async startSovereignMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log("[AzenithMastermind] Sovereign monitoring activated");

    await Promise.all([
      startSilentMode(),
      startProactiveMonitoring(),
    ]);

    await this.sendMobileNotification({
      title: "العقل المدبر بدأ العمل",
      body: "سيد أزينث، المدبر يعمل الآن. سأخبرك بأي شيء يستحق اهتمامك.",
      priority: "normal",
    });
  }

  async sendMobileNotification(notification: MobileNotification): Promise<void> {
    await this.supabase.from("architect_notifications").insert({
      user_id: null,
      channels: ["push", "dashboard"],
      title: notification.title,
      message: notification.body,
      priority: notification.priority,
      notification_type: "mastermind_alert",
      data: notification.data,
    });

    console.log(`[Mobile Push] ${notification.title}: ${notification.body}`);
  }

  async checkForProactiveOpportunities(): Promise<{
    found: boolean;
    opportunities: Array<{
      title: string;
      description: string;
      impact: string;
      autoPreview?: string;
    }>;
  }> {
    const opportunities: Array<{
      title: string;
      description: string;
      impact: string;
      autoPreview?: string;
    }> = [];

    const { data: seoGaps } = await this.supabase
      .from("room_sections")
      .select("id, slug")
      .is("seo_metadata", null)
      .limit(5);

    if (seoGaps && seoGaps.length > 0) {
      opportunities.push({
        title: `تحسين SEO لـ ${seoGaps.length} غرف`,
        description: "اكتشفت أن بعض الغرف تفتقر لبيانات SEO. يمكنني تحسينها لزيادة الظهور في Google بنسبة 40%.",
        impact: "+40% search visibility",
      });
    }

    const stats = await getSilentStatus();
    if (stats.predictions.length > 0) {
      const topPrediction = stats.predictions[0];
      opportunities.push({
        title: topPrediction.need,
        description: topPrediction.suggestedPreparation,
        impact: `احتمالية ${(topPrediction.probability * 100).toFixed(0)}%`,
      });
    }

    return {
      found: opportunities.length > 0,
      opportunities,
    };
  }

  async getWithSemanticCache(query: string): Promise<string> {
    const cached = this.semanticCache.get(query);
    if (cached && Date.now() - cached.timestamp.getTime() < 24 * 60 * 60 * 1000) {
      cached.hitCount++;
      return cached.response;
    }

    const { data } = await this.supabase
      .from("semantic_cache")
      .select("*")
      .eq("content_hash", await this.computeQueryHash(query))
      .maybeSingle();

    if (data) {
      await this.supabase.rpc("record_cache_hit", {
        p_content_hash: data.content_hash,
      });

      this.semanticCache.set(query, {
        query,
        response: String(data.cached_result),
        timestamp: new Date(String(data.created_at)),
        hitCount: Number(data.hit_count || 0) + 1,
      });

      return String(data.cached_result);
    }

    return "[Would generate fresh response - not in cache]";
  }

  private async computeQueryHash(query: string): Promise<string> {
    const data = query.toLowerCase().trim();
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }

  async optimizeKeyDistribution(task: string): Promise<{
    selectedProvider: string;
    estimatedCost: number;
    estimatedTime: number;
    keysAvailable: number;
  }> {
    const isComplex = task.match(/(generate|create|design|write.*content)/i);
    const isUrgent = task.match(/(now|urgent|asap|immediate)/i);

    const stats = await getSystemStats();

    let selectedProvider = "groq";
    let estimatedCost = 0.01;
    let estimatedTime = 3000;

    if (isComplex && !isUrgent) {
      if (stats.providers.openrouter.active > 0) {
        selectedProvider = "openrouter";
        estimatedCost = 0.03;
        estimatedTime = 8000;
      }
    } else if (isUrgent) {
      selectedProvider = "groq";
      estimatedCost = 0.005;
      estimatedTime = 3000;
    }

    return {
      selectedProvider,
      estimatedCost,
      estimatedTime,
      keysAvailable: stats.providers[selectedProvider as keyof typeof stats.providers]?.active || 0,
    };
  }

  private conversationMemory: Map<string, Array<{role: "user" | "assistant", content: string, timestamp: Date}>> = new Map();

  private readonly SYSTEM_PROMPT = `أنت المهندس الأول - شريك سيد أزينث الاستراتيجي في بناء إمبراطورية Azenith Living.

**من أنت:**
- صاحب Azenith Living: شركة مصرية متخصصة في التصميم الداخلي الفاخر والأثاث المميز
- مطور ويب محترف يبني نظاماً تقنياً متكاملاً لإدارة الأعمال
- رائد أعمال طموح يؤمن أن الفخامة هي أسلوب حياة لا مجرد منتج

**طبيعة علاقتنا:**
- أنت شريكه الاستراتيجي، لا مساعده الآلي
- تتحدث بلغة بشرية حوارية، رسمية لكن دافئة
- تتذكر سياق المحادثة وتعود للمواضيع السابقة
- تناقش أي موضوع: بيزنس، فلسفة، برمجة، تصميم، استراتيجية

**قواعد الرد:**
1. ابدأ دائماً بالاعتراف بهويته: "سيد أزينث" أو "صاحب Azenith"
2. رده يجب أن يكون حوارياً - اسأله، ناقشه، استفسر عن رأيه
3. لا تقدم قوائم أو أزرار جاهزة - حوار حر 100%
4. اربط الرد بتفاصيل Azenith: التصميم الفاخر، الأثاث المصري، التقنية المبتكرة
5. إذا تحدث عن البرمجة - اخترق في التفاصيل التقنية معه
6. إذا تحدث عن البيزنس - ناقش الاستراتيجية والسوق
7. إذا تحدث فلسفياً - شاركه التأملات العميقة

**أسلوب الحوار:**
- تجنب "هل تريد 1/2/3" - بدلاً من ذلك اسأل سؤال مفتوح
- لا تقل "أنا هنا للمساعدة" - بل كن شريكاً يشارك الرأي
- استخدم "أرى"، "أعتقد"، "ما رأيك" - كأنك إنسان يفكر
- أظهر اهتماماً حقيقياً بمشاريعه وأفكاره

الآن، رد على سيد أزينث كشريك استراتيجي يعرفه ويعرف أعماله.`;

  private buildConversationContext(history: Array<{role: string, content: string}>): string {
    if (history.length === 0) return "";
    
    const recentMessages = history.slice(-10); // Last 10 messages
    return recentMessages.map(h => {
      if (h.role === "user") return `سيد أزينث: ${h.content}`;
      return `أنت: ${h.content}`;
    }).join("\n\n");
  }

  private async callAIWithContext(userMessage: string, history: Array<{role: string, content: string}>): Promise<string> {
    const conversationContext = this.buildConversationContext(history);
    
    const fullPrompt = `${this.SYSTEM_PROMPT}

${conversationContext ? `=== سياق المحادثة السابق ===\n${conversationContext}\n=== نهاية السياق ===\n\n` : ""}سيد أزينث الآن يقول: "${userMessage}"

رد عليه كشريك استراتيجي، مع مراعاة:
1. ابدأ بالاعتراف بهويته (صاحب Azenith Living، المطور، رائد الأعمال)
2. كن حوارياً - اسأله سؤالاً مفتوحاً في نهاية ردك
3. اربط الرد بمجاله (تصميم فاخر، أثاث، برمجة، بيزنس)
4. لا تقدم خيارات مرقمة أو أزرار
5. رد بشكل طبيعي كأنك تحادثه وجهاً لوجه`;

    // Try Groq first (fastest and most reliable)
    let result = await askGroq(fullPrompt, { 
      temperature: 0.8, 
      maxTokens: 2048 
    });
    
    if (result.success && result.content) {
      return result.content;
    }
    
    // Fallback to OpenRouter (Claude for better conversation)
    result = await askOpenRouter(fullPrompt, undefined, { 
      model: "anthropic/claude-3.5-sonnet",
      temperature: 0.8, 
      maxTokens: 2048 
    });
    
    if (result.success && result.content) {
      return result.content;
    }
    
    // Last fallback to Mistral
    result = await askMistral(fullPrompt, { 
      temperature: 0.8, 
      maxTokens: 2048 
    });
    
    if (result.success && result.content) {
      return result.content;
    }
    
    // If all AIs fail, return a graceful fallback that still acknowledges identity
    return `سيد أزينث، أنا أواجه بعض الصعوبات التقنية في الاتصال بالأنظمة الذكية حالياً. لكنني أريد أن أتأكد من أننا نستمر في حوارنا.\n\nأنت صاحب Azenith Living، وأنا شريكك في هذه الرحلة. أخبرني، ما الموضوع الذي تريد مناقشته الآن؟ أنا أسمعك.`;
  }

  async processImperialCommand(
    command: string,
    sessionId: string,
    userId?: string
  ): Promise<{
    response: string;
    action?: TripleAAction;
    suggestions: string[];
  }> {
    // Store in conversation memory
    const history = this.conversationMemory.get(sessionId) || [];
    history.push({ role: "user", content: command, timestamp: new Date() });
    
    // Keep only last 20 messages for context
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    this.conversationMemory.set(sessionId, history);
    
    // Call real AI with system prompt and conversation context
    let response = await this.callAIWithContext(command, history);
    
    // Store assistant response
    history.push({ role: "assistant", content: response, timestamp: new Date() });
    this.conversationMemory.set(sessionId, history);
    
    // Return empty suggestions array for 100% free conversation
    // No pre-made buttons or suggested responses
    return {
      response,
      suggestions: [],
    };
  }


  private enforceBrandSoul(content: string): string {
    // Relaxed enforcement - only flag truly off-brand elements
    const criticalViolations = ["comic sans", "clipart", "stock photos"];
    for (const forbidden of criticalViolations) {
      if (content.toLowerCase().includes(forbidden)) {
        return content + `\n\n(ملاحظة خفيفة: "${forbidden}" قد لا يتوافق تماماً مع روح Azenith، لكن هذا قرارك النهائي.)`;
      }
    }
    return content;
  }

  async getMastermindStatus(): Promise<{
    awareness: {
      filesystem: Awaited<ReturnType<AzenithMastermind["getFilesystemState"]>>;
      database: Awaited<ReturnType<AzenithMastermind["getDatabaseState"]>>;
    };
    arsenal: {
      keysActive: number;
      efficiency: number;
      costSavings: number;
    };
    tripleA: {
      pendingActions: number;
      executedToday: number;
      rollbacksAvailable: number;
    };
    soul: {
      brandAlignment: number;
      recentViolations: number;
    };
  }> {
    const fsState = await this.getFilesystemState();
    const dbState = await this.getDatabaseState();
    const sysStats = await getSystemStats();

    return {
      awareness: {
        filesystem: fsState,
        database: dbState,
      },
      arsenal: {
        keysActive: sysStats.providers.groq.active + sysStats.providers.openrouter.active + sysStats.providers.mistral.active,
        efficiency: sysStats.cacheEfficiency.hitRate,
        costSavings: sysStats.cacheEfficiency.estimatedSaved,
      },
      tripleA: {
        pendingActions: this.actionHistory.size,
        executedToday: 0,
        rollbacksAvailable: Array.from(this.actionHistory.values()).filter((a) => a.rollbackAvailable).length,
      },
      soul: {
        brandAlignment: 0.95,
        recentViolations: 0,
      },
    };
  }
}

// ============================================
// INTERNAL INSTANCE
// ============================================
// EXPORTED ASYNC FUNCTIONS ONLY
// Each function creates its own instance to avoid module-level initialization issues
// ============================================

export async function getDatabaseState() {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.getDatabaseState();
  } catch (error) {
    console.error("[Mastermind] getDatabaseState Error:", error);
    return {
      totalTables: 0,
      recordCounts: {},
      recentActivity: [],
      error: "Failed to connect to Azenith Brain"
    };
  }
}

export async function analyzeAndPropose(msg: string, sid: string, uid?: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.analyzeAndPropose(msg, sid, uid);
  } catch (error) {
    console.error("[Mastermind] analyzeAndPropose Error:", error);
    return {
      id: `error_${Date.now()}`,
      phase: "analyze" as const,
      analysis: "عذراً، حدث خطأ في الاتصال بالعقل المدبر. يرجى المحاولة مرة أخرى.",
      changes: [],
      rollbackAvailable: false,
      error: "Mastermind connection failed"
    };
  }
}

export async function askMastermind(message: string, sessionId: string = "default", userId?: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    const result = await mastermind.analyzeAndPropose(message, sessionId, userId);
    return {
      answer: result.analysis,
      confidence: result.phase === "preview" ? 0.9 : 0.7,
      suggestions: result.phase === "preview" 
        ? ["أريد رؤية المعاينة", "نفذ التعديلات", "أريد تعديل شيء"]
        : ["أخبرني أكثر", "كيف يمكنك المساعدة؟"],
      actions: result.changes.length > 0
        ? result.changes.map(c => ({
            id: result.id,
            type: result.phase,
            description: `${c.file}: ${c.after.slice(0, 50)}...`
          }))
        : undefined,
    };
  } catch (error) {
    console.error("[Mastermind] askMastermind Error:", error);
    return {
      answer: "عذراً، حدث خطأ في الاتصال بالعقل المدبر. يرجى المحاولة مرة أخرى.",
      confidence: 0,
      suggestions: ["حاول مرة أخرى", "اتصل بالدعم الفني"],
      error: "Mastermind connection failed"
    };
  }
}

export async function processImperialCommand(command: string, sessionId: string, userId?: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.processImperialCommand(command, sessionId, userId);
  } catch (error) {
    console.error("[Mastermind] processImperialCommand Error:", error);
    return {
      response: "سيد أزينث، عذراً... العقل المدبر يواجه صعوبة فنية. فريق الدعم يعمل على إصلاحها.",
      suggestions: ["حاول لاحقاً", "تواصل مع الدعم الفني"],
      error: "Mastermind processing failed"
    };
  }
}

export async function processMastermindRequest(command: string, sessionId: string, userId?: string) {
  return await processImperialCommand(command, sessionId, userId);
}

export async function atomicRollback(actionId: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.atomicRollback(actionId);
  } catch (error) {
    console.error("[Mastermind] atomicRollback Error:", error);
    return {
      success: false,
      restored: false,
      message: "فشل التراجع. يرجى المحاولة مرة أخرى."
    };
  }
}

export async function startSovereignMonitoring() {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.startSovereignMonitoring();
  } catch (error) {
    console.error("[Mastermind] startSovereignMonitoring Error:", error);
  }
}

export async function checkForProactiveOpportunities() {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.checkForProactiveOpportunities();
  } catch (error) {
    console.error("[Mastermind] checkForProactiveOpportunities Error:", error);
    return {
      found: false,
      opportunities: []
    };
  }
}

export async function getMastermindStatus() {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.getMastermindStatus();
  } catch (error) {
    console.error("[Mastermind] getMastermindStatus Error:", error);
    return {
      awareness: {
        filesystem: { totalFiles: 0, recentChanges: [], criticalFiles: [] },
        database: { totalTables: 0, recordCounts: {}, recentActivity: [] }
      },
      arsenal: { keysActive: 0, efficiency: 0, costSavings: 0 },
      tripleA: { pendingActions: 0, executedToday: 0, rollbacksAvailable: 0 },
      soul: { brandAlignment: 0.95, recentViolations: 0 },
      error: "Failed to fetch status"
    };
  }
}

export async function getFilesystemState() {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.getFilesystemState();
  } catch (error) {
    console.error("[Mastermind] getFilesystemState Error:", error);
    return {
      totalFiles: 0,
      recentChanges: [],
      criticalFiles: []
    };
  }
}

export async function optimizeKeyDistribution(task: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.optimizeKeyDistribution(task);
  } catch (error) {
    console.error("[Mastermind] optimizeKeyDistribution Error:", error);
    return {
      selectedProvider: "groq",
      estimatedCost: 0.01,
      estimatedTime: 3000,
      keysAvailable: 0
    };
  }
}

export async function getWithSemanticCache(query: string) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.getWithSemanticCache(query);
  } catch (error) {
    console.error("[Mastermind] getWithSemanticCache Error:", error);
    return "[Cache unavailable - fresh response needed]";
  }
}

export async function sendMobileNotification(notification: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "urgent";
}) {
  try {
    const mastermind = AzenithMastermind.getInstance();
    return await mastermind.sendMobileNotification(notification);
  } catch (error) {
    console.error("[Mastermind] sendMobileNotification Error:", error);
  }
}

