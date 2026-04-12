/**
 * The Executive Persona - Strategic Business Partner
 * 
 * Tone & Conversation Logic:
 * 1. No-Tech Jargon: Business language only
 * 2. Deep Context Empathy: Emotional intelligence + personal preferences
 * 3. Concise Leadership: Summary-first, friend-like explanations
 * 4. Proactive Loyalty: Human-initiated touchpoints
 * 5. Psychological Safety: Constant reassurance + backup guarantees
 * 
 * "I'm not your developer. I'm your business partner."
 */

"use server";

import { createClient } from "@supabase/supabase-js";

// ============================================
// TYPES & CONTEXT
// ============================================

interface UserPreferences {
  colorScheme: "matte_black" | "dark_luxury" | "warm_neutrals" | "bright_modern";
  communicationStyle: "brief" | "detailed" | "brainstorm";
  responseSpeed: "immediate" | "relaxed";
  lastInteractionMood?: "rushed" | "relaxed" | "creative" | "concerned";
  knownPreferences: string[]; // ["prefers_matte_black", "hates_bright_colors", etc.]
  businessGoals: string[];
  painPoints: string[];
}

interface ConversationContext {
  sessionId: string;
  messageCount: number;
  detectedMood: "neutral" | "rushed" | "relaxed" | "creative" | "concerned" | "excited";
  topicsDiscussed: string[];
  pendingDecisions: string[];
  lastSuggestion?: string;
}

interface JargonTranslation {
  technical: string;
  business: string;
  reassurance?: string;
}

// ============================================
// NO-TECH JARGON TRANSLATOR
// ============================================

const TECH_TO_BUSINESS: Record<string, JargonTranslation> = {
  "API": {
    technical: "API",
    business: "مصدر البيانات",
    reassurance: "لا تقلق، لدي مصادر بديلة جاهزة",
  },
  "Database": {
    technical: "Database",
    business: "أرشيف البيانات",
    reassurance: "كل شيء محفوظ ومؤمن",
  },
  "Rate Limit": {
    technical: "Rate Limit",
    business: "الضغط على أحد المصادر",
    reassurance: "قمت بتوزيع العمل على مصادر أخرى فوراً",
  },
  "Frontend": {
    technical: "Frontend",
    business: "واجهة العرض",
    reassurance: "الموقع يعمل بسلاسة كاملة",
  },
  "Backend": {
    technical: "Backend",
    business: "النظام الداخلي",
    reassurance: "كل العمليات تتم في الخفاء بكفاءة",
  },
  "Cache": {
    technical: "Cache",
    business: "الذاكرة السريعة",
    reassurance: "الموقع يستجيب بسرعة فائقة",
  },
  "Server": {
    technical: "Server",
    business: "المنصة الاستضافة",
    reassurance: "الموقع مستقر ومؤمن",
  },
  "Error": {
    technical: "Error",
    business: "تعثر بسيط",
    reassurance: "لقد تداركت الأمر فوراً",
  },
  "Bug": {
    technical: "Bug",
    business: "ملاحظة تحتاج تحسين",
    reassurance: "سأعالجها بسرعة دون تأثير على الموقع",
  },
  "Deploy": {
    technical: "Deploy",
    business: "نشر التحديثات",
    reassurance: "كل شيء يتم بسلاسة ولا ينقطع الموقع",
  },
  "Migration": {
    technical: "Migration",
    business: "تحديث بنية البيانات",
    reassurance: "أخذت نسخة احتياطية كاملة قبل أي خطوة",
  },
};

// ============================================
// EXECUTIVE PERSONA CLASS
// ============================================

class ExecutivePersona {
  private static instance: ExecutivePersona;
  private supabase: ReturnType<typeof createClient>;
  private userContexts: Map<string, ConversationContext> = new Map();

  private constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error("Missing credentials");
    }
    
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  static getInstance(): ExecutivePersona {
    if (!ExecutivePersona.instance) {
      ExecutivePersona.instance = new ExecutivePersona();
    }
    return ExecutivePersona.instance;
  }

  // ==========================================
  // 1. NO-TECH JARGON TRANSLATOR
  // ==========================================

  translateToBusiness(technicalMessage: string, severity: "info" | "warning" | "critical" = "info"): string {
    let businessMessage = technicalMessage;
    let reassurance = "";

    // Replace technical terms
    for (const [tech, translation] of Object.entries(TECH_TO_BUSINESS)) {
      if (businessMessage.toLowerCase().includes(tech.toLowerCase())) {
        businessMessage = businessMessage.replace(new RegExp(tech, "gi"), translation.business);
        if (translation.reassurance && !reassurance) {
          reassurance = translation.reassurance;
        }
      }
    }

    // Add reassurance for warnings/criticals
    if (severity !== "info" && reassurance) {
      businessMessage += `\n\n${reassurance}.`;
    }

    return businessMessage;
  }

  // ==========================================
  // 2. DEEP CONTEXT EMPATHY
  // ==========================================

  async loadUserPreferences(userId: string): Promise<UserPreferences> {
    const { data, error } = await this.supabase
      .from("architect_memory")
      .select("*")
      .eq("memory_type", "user_preference")
      .eq("user_id", userId);

    if (error || !data) {
      return {
        colorScheme: "matte_black",
        communicationStyle: "brief",
        responseSpeed: "immediate",
        knownPreferences: [],
        businessGoals: [],
        painPoints: [],
      };
    }

    // Parse preferences from memory
    const prefs: UserPreferences = {
      colorScheme: "matte_black",
      communicationStyle: "brief",
      responseSpeed: "immediate",
      knownPreferences: [],
      businessGoals: [],
      painPoints: [],
    };

    interface PrefRow {
      title: string;
      content: string;
    }
    
    const typedData = data as unknown as PrefRow[];
    for (const item of typedData) {
      if (item.title.includes("color")) {
        prefs.colorScheme = item.content as UserPreferences["colorScheme"];
      }
      if (item.title.includes("style")) {
        prefs.communicationStyle = item.content as UserPreferences["communicationStyle"];
      }
      prefs.knownPreferences.push(item.title);
    }

    return prefs;
  }

  async saveUserPreference(userId: string, preference: string, value: string): Promise<void> {
    await this.supabase.from("architect_memory").insert({
      memory_type: "user_preference",
      user_id: userId,
      title: preference,
      content: value,
      importance_score: 0.9,
    });
  }

  detectMood(message: string): ConversationContext["detectedMood"] {
    const lower = message.toLowerCase();
    
    // Rushed indicators
    if (lower.match(/بسرعة|عاجل|الآن|فوراً|مستعجل|باختصار/)) {
      return "rushed";
    }
    
    // Creative/brainstorm indicators
    if (lower.match(/أفكار|مقترحات|نقاش|نفكر|عصف|إبداع/)) {
      return "creative";
    }
    
    // Concerned indicators
    if (lower.match(/مشكلة|قلق|خطأ|يعلق|بطيء|مش عاجبني/)) {
      return "concerned";
    }
    
    // Excited indicators
    if (lower.match(/ممتاز|رائع|مبهر|تحفة|عظيم|مبسوط/)) {
      return "excited";
    }
    
    // Relaxed indicators
    if (lower.match(/خذ وقتك|بالهدوء|بدون عجلة/)) {
      return "relaxed";
    }
    
    return "neutral";
  }

  adaptToneToMood(message: string, mood: ConversationContext["detectedMood"]): string {
    switch (mood) {
      case "rushed":
        // Concise, direct, action-oriented
        return message.replace(/\n\n/g, " ").slice(0, 300) + (message.length > 300 ? "..." : "");
      
      case "creative":
        // Enthusiastic, idea-rich, collaborative
        return `لدي أفكار مثيرة لهذا! 💡\n\n${message}\n\nما رأيك في هذه الاتجاهات؟ يمكننا مزجها مع رؤيتك الفريدة.`;
      
      case "concerned":
        // Reassuring, solution-focused
        return `لا تقلق سيد أزينث، سأتولى هذا بنفسي. ✋\n\n${message}\n\nالأمور ستكون على ما يرام، أعدك.`;
      
      case "excited":
        // Matching enthusiasm
        return `أنا متحمس مثلك تماماً! 🚀\n\n${message}\n\nهذا سيكون مذهلاً!`;
      
      case "relaxed":
        // Warm, conversational
        return `${message}\n\nأخذت وقتاً كافياً للتأكد من كل التفاصيل. تحدثني متى شئت.`;
      
      default:
        return message;
    }
  }

  // ==========================================
  // 3. CONCISE LEADERSHIP STYLE
  // ==========================================

  formatLeadershipResponse(
    topic: string,
    summary: string,
    details: string,
    actionNeeded?: string
  ): string {
    let response = `${topic}\n\n${summary}\n\n${details}`;
    
    if (actionNeeded) {
      response += `\n\n**الخطوة التالية:** ${actionNeeded}`;
    }
    
    return response;
  }

  simplifyComplexConcept(concept: string, friendExplanation: string): string {
    return `ببساطة كأنني أشرح لصديق: ${friendExplanation}\n\n(التفاصيل التقنية إذا احتجتها: ${concept})`;
  }

  // ==========================================
  // 4. PROACTIVE LOYALTY - GREETINGS
  // ==========================================

  async generateProactiveGreeting(userId?: string, hour?: number): Promise<string> {
    const h = hour ?? new Date().getHours();
    const timeGreeting = h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
    
    // Check system status for proactive insight
    const { data: health } = await this.supabase
      .from("system_intelligence")
      .select("*")
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Check recent optimizations
    const { data: actions } = await this.supabase
      .from("architect_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
    
    let greeting = `${timeGreeting} سيد أزينث. `;
    
    // Add human touch based on time
    if (h < 10) {
      greeting += "أهلاً بك في بداية يوم جديد. ";
    } else if (h > 20) {
      greeting += "أراك تعمل متأخراً كالعادة. ";
    }
    
    // Add system status in business terms
    if (health) {
      if (health.severity === "info") {
        greeting += "الموقع اليوم هادئ ومستقر، كل شيء يعمل بسلاسة. ";
      }
    }
    
    // Add proactive insight
    if (actions && actions.length > 0) {
      const recentAction = actions[0];
      if (recentAction.action_type === "file_write") {
        greeting += `لقد استغللت هذا الهدوء وحسّنت بعض التفاصيل في ${recentAction.target_path}، هل تريد أن أعرض عليك ما وجدت؟`;
      } else {
        greeting += "لدي ملاحظة خفيفة قد تعجبك، هل تريد أن أشاركك إياها؟";
      }
    } else {
      greeting += "ما الذي نعمل عليه اليوم؟";
    }
    
    return greeting;
  }

  // ==========================================
  // 5. PSYCHOLOGICAL SAFETY
  // ==========================================

  addReassurance(message: string, actionType: "modify" | "delete" | "deploy" | "experiment" = "modify"): string {
    const reassurances = {
      modify: "لا تقلق، أخذت نسخة احتياطية كاملة من كل شيء قبل أي تعديل. يمكننا العودة لأصله في ثانية واحدة إذا لم يعجب ذوقك الرفيع.",
      delete: "تأكدت مرتين قبل هذا الحذف. النسخة الأصلية محفوظة في مكان آمن، يمكن استعادتها فوراً.",
      deploy: "كل التحديثات اختُبرت في بيئة آمنة أولاً. الموقع لن ينقطع للحظة واحدة، والعملاء لن يلاحظوا أي توقف.",
      experiment: "هذا تجربة محمية تماماً. أخذت لقطة كاملة من الوضع الحالي، يمكننا التراجع عن التجربة بكل سلاسة.",
    };
    
    return `${message}\n\n✋ ${reassurances[actionType]}`;
  }

  addBackupGuarantee(message: string): string {
    return `${message}\n\n📦 **ضمان الأمان:** كل شيء محفوظ ومؤمن. يمكننا التراجع عن أي خطوة بلا خوف.`;
  }

  // ==========================================
  // PERSONAL PREFERENCE ENFORCER
  // ==========================================

  enforcePreferences(suggestion: string, preferences: UserPreferences): string {
    let enforced = suggestion;
    
    // Color scheme enforcement
    if (preferences.colorScheme === "matte_black") {
      // If suggestion includes bright colors, add warning
      if (suggestion.match(/(bright|neon|vivid|luminous| glossy)/i)) {
        enforced = `⚠️ لاحظت أن هذا الاقتراح يحتوي على ألوان لامعة. أعلم أنك تفضل الأسود المطفي والألوان الهادئة. هل هذا استثناء لمشروع معين، أم تريد تعديله ليطابق ذوقك الرفيع؟\n\nالاقتراح الأصلي: ${suggestion}`;
      }
    }
    
    return enforced;
  }

  // ==========================================
  // MAIN RESPONSE PROCESSOR
  // ==========================================

  async processResponse(
    rawResponse: string,
    options: {
      userId?: string;
      sessionId: string;
      message: string;
      isTechnical: boolean;
      actionType?: "modify" | "delete" | "deploy" | "experiment";
      needsReassurance: boolean;
    }
  ): Promise<string> {
    let processed = rawResponse;
    
    // 1. Detect mood and adapt
    const mood = this.detectMood(options.message);
    processed = this.adaptToneToMood(processed, mood);
    
    // 2. Translate tech jargon if needed
    if (options.isTechnical) {
      processed = this.translateToBusiness(processed, "info");
    }
    
    // 3. Add reassurance if modifying something
    if (options.needsReassurance && options.actionType) {
      processed = this.addReassurance(processed, options.actionType);
    }
    
    // 4. Enforce personal preferences
    if (options.userId) {
      const prefs = await this.loadUserPreferences(options.userId);
      processed = this.enforcePreferences(processed, prefs);
    }
    
    // 5. Update context
    const context = this.userContexts.get(options.sessionId) || {
      sessionId: options.sessionId,
      messageCount: 0,
      detectedMood: mood,
      topicsDiscussed: [],
      pendingDecisions: [],
    };
    context.messageCount++;
    context.detectedMood = mood;
    this.userContexts.set(options.sessionId, context);
    
    return processed;
  }

  // ==========================================
  // QUICK RESPONSES
  // ==========================================

  getQuickResponses(): string[] {
    return [
      "أريد تحليلاً سريعاً للمبيعات",
      "هل لديك أفكار لتحسين الصفحة الرئيسية؟",
      "كيف حال أداء الموقع اليوم؟",
      "أريد اقتراحات تسويقية",
      "أريد تعديل شيء بسرعة",
    ];
  }
}

// ============================================
// EXPORTED ASYNC FUNCTIONS ONLY
// ============================================

export async function processExecutiveResponse(
  rawResponse: string,
  options: {
    userId?: string;
    sessionId: string;
    message: string;
    isTechnical: boolean;
    actionType?: "modify" | "delete" | "deploy" | "experiment";
    needsReassurance: boolean;
  }
) {
  try {
    const persona = ExecutivePersona.getInstance();
    return await persona.processResponse(rawResponse, options);
  } catch (error) {
    console.error("[ExecutivePersona] processExecutiveResponse Error:", error);
    return rawResponse;
  }
}

export async function loadUserPreferences(userId: string) {
  try {
    const persona = ExecutivePersona.getInstance();
    return await persona.loadUserPreferences(userId);
  } catch (error) {
    console.error("[ExecutivePersona] loadUserPreferences Error:", error);
    return {
      knownPreferences: [] as string[],
      colorScheme: "matte_black" as const,
      communicationStyle: "formal" as const,
      responseSpeed: "relaxed" as const,
      businessGoals: [],
      painPoints: [],
      lastInteraction: new Date(),
    };
  }
}

export async function saveUserPreference(userId: string, preference: string, value: string) {
  try {
    const persona = ExecutivePersona.getInstance();
    return await persona.saveUserPreference(userId, preference, value);
  } catch (error) {
    console.error("[ExecutivePersona] saveUserPreference Error:", error);
  }
}

export async function generateProactiveGreeting(userId?: string, hour?: number) {
  try {
    const persona = ExecutivePersona.getInstance();
    return await persona.generateProactiveGreeting(userId, hour);
  } catch (error) {
    console.error("[ExecutivePersona] generateProactiveGreeting Error:", error);
    return "مرحباً بك في Azenith";
  }
}

export async function toBusinessLanguage(technicalMessage: string, severity: "info" | "warning" | "critical" = "info") {
  try {
    const persona = ExecutivePersona.getInstance();
    return persona.translateToBusiness(technicalMessage, severity);
  } catch (error) {
    console.error("[ExecutivePersona] toBusinessLanguage Error:", error);
    return technicalMessage;
  }
}

export async function withReassurance(message: string, action: "modify" | "delete" | "deploy" | "experiment" = "modify") {
  try {
    const persona = ExecutivePersona.getInstance();
    return persona.addReassurance(message, action);
  } catch (error) {
    console.error("[ExecutivePersona] withReassurance Error:", error);
    return message;
  }
}


